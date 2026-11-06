import asyncio
import datetime as dt
import uuid
from collections.abc import Awaitable, Callable
from decimal import Decimal

from alembic import command
from alembic.config import Config
from conftest import ALEMBIC_INI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
from sqlalchemy.pool import NullPool

# The revision that gives each user exactly one portfolio.
ONE_PORTFOLIO_REVISION = "5a754f0028a1"

# A user without a portfolio, and one with two.
ALICE = uuid.UUID(int=1)
BOB = uuid.UUID(int=2)
BOB_OLDEST = uuid.UUID(int=21)
BOB_NEWEST = uuid.UUID(int=22)
INSTRUMENTS = {"AAPL": uuid.UUID(int=31), "MSFT": uuid.UUID(int=32), "NVDA": uuid.UUID(int=33)}

JANUARY = dt.datetime(2026, 1, 1, tzinfo=dt.UTC)
FEBRUARY = dt.datetime(2026, 2, 1, tzinfo=dt.UTC)
MARCH = dt.datetime(2026, 3, 1, tzinfo=dt.UTC)


def test_portfolio_migration_gives_each_user_one_portfolio(migrated_database: str) -> None:
    config = Config(ALEMBIC_INI, attributes={"configure_logger": False})
    command.downgrade(config, f"{ONE_PORTFOLIO_REVISION}-1")
    try:
        asyncio.run(_run(migrated_database, _seed))
        command.upgrade(config, "head")
        portfolios, positions = asyncio.run(_run(migrated_database, _read))
    finally:
        asyncio.run(_run(migrated_database, _clean_up))
        command.upgrade(config, "head")

    assert set(portfolios) == {ALICE, BOB}
    assert portfolios[ALICE][1] == "My portfolio"
    assert portfolios[BOB] == (BOB_OLDEST, "Long term")
    # AAPL was in both: the newest portfolio's position was updated last.
    assert positions == {
        (BOB_OLDEST, "AAPL", Decimal(3)),
        (BOB_OLDEST, "MSFT", Decimal(2)),
        (BOB_OLDEST, "NVDA", Decimal(4)),
    }


async def _run[T](url: str, work: Callable[[AsyncConnection], Awaitable[T]]) -> T:
    """Run `work` in one committed transaction, on an engine of its own."""
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.begin() as connection:
        result = await work(connection)
    await engine.dispose()
    return result


async def _seed(connection: AsyncConnection) -> None:
    await connection.execute(
        text("INSERT INTO users (id, email, hashed_password) VALUES (:id, :email, 'hash')"),
        [{"id": ALICE, "email": "alice@example.com"}, {"id": BOB, "email": "bob@example.com"}],
    )
    await connection.execute(
        text(
            "INSERT INTO instruments (id, type, name, yahoo_symbol, exchange_code, currency)"
            " VALUES (:id, 'stock', :symbol, :symbol, 'NMS', 'USD')"
        ),
        [{"id": id, "symbol": symbol} for symbol, id in INSTRUMENTS.items()],
    )
    await connection.execute(
        text(
            "INSERT INTO portfolios (id, user_id, name, created_at)"
            " VALUES (:id, :user_id, :name, :created_at)"
        ),
        [
            {"id": BOB_OLDEST, "user_id": BOB, "name": "Long term", "created_at": JANUARY},
            {"id": BOB_NEWEST, "user_id": BOB, "name": "Trading", "created_at": FEBRUARY},
        ],
    )
    await connection.execute(
        text(
            "INSERT INTO positions (portfolio_id, instrument_id, quantity, updated_at)"
            " VALUES (:portfolio_id, :instrument_id, :quantity, :updated_at)"
        ),
        [
            _position(BOB_OLDEST, "AAPL", 1, JANUARY),
            _position(BOB_OLDEST, "MSFT", 2, JANUARY),
            _position(BOB_NEWEST, "AAPL", 3, MARCH),
            _position(BOB_NEWEST, "NVDA", 4, FEBRUARY),
        ],
    )


def _position(
    portfolio_id: uuid.UUID, symbol: str, quantity: int, updated_at: dt.datetime
) -> dict[str, object]:
    return {
        "portfolio_id": portfolio_id,
        "instrument_id": INSTRUMENTS[symbol],
        "quantity": Decimal(quantity),
        "updated_at": updated_at,
    }


async def _read(
    connection: AsyncConnection,
) -> tuple[dict[uuid.UUID, tuple[uuid.UUID, str]], set[tuple[uuid.UUID, str, Decimal]]]:
    """Each user's portfolio id and name, and each position's portfolio, symbol and quantity."""
    portfolios = await connection.execute(text("SELECT user_id, id, name FROM portfolios"))
    positions = await connection.execute(
        text(
            "SELECT portfolio_id, yahoo_symbol, quantity FROM positions"
            " JOIN instruments ON instruments.id = positions.instrument_id"
        )
    )
    return (
        {user_id: (id, name) for user_id, id, name in portfolios},
        {(portfolio_id, symbol, quantity) for portfolio_id, symbol, quantity in positions},
    )


async def _clean_up(connection: AsyncConnection) -> None:
    """Delete the seeded rows; portfolios and positions go with their user."""
    await connection.execute(
        text("DELETE FROM users WHERE id IN (:alice, :bob)"), {"alice": ALICE, "bob": BOB}
    )
    await connection.execute(
        text("DELETE FROM instruments WHERE id = ANY(:ids)"), {"ids": list(INSTRUMENTS.values())}
    )
