import asyncio
import datetime as dt
from collections.abc import AsyncGenerator, Awaitable, Callable, Iterator
from decimal import Decimal
from pathlib import Path
from typing import Protocol

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.exceptions import ProviderUnavailableError
from app.core.security import create_access_token
from app.integrations.openfigi.client import OpenFigiClient
from app.integrations.openfigi.dependencies import get_openfigi_client
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.dependencies import get_yahoo_client
from app.integrations.yahoo.schemas import ListingDetails, PriceHistory, SearchResult
from app.main import create_app
from app.modules.instruments.models import Instrument, InstrumentType
from app.modules.portfolios.models import Portfolio
from app.modules.positions.models import Position
from app.modules.prices.models import DailyPrice
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate
from app.modules.users.service import create_user

ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[str]:
    """Recreate the test database and migrate it to head; downgrade it to base at the end."""
    url = str(get_settings().database_url)
    name = make_url(url).database
    if name is None or not name.endswith("_test"):
        raise RuntimeError(f"Refusing to recreate {name!r}: test databases must end in '_test'.")

    asyncio.run(_recreate_database(url))
    config = Config(ALEMBIC_INI, attributes={"configure_logger": False})
    command.upgrade(config, "head")
    yield url
    command.downgrade(config, "base")


async def _recreate_database(url: str) -> None:
    test_url = make_url(url)
    # CREATE/DROP DATABASE cannot run inside a transaction, hence AUTOCOMMIT.
    engine = create_async_engine(test_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with engine.connect() as connection:
        name = connection.dialect.identifier_preparer.quote(test_url.database or "")
        await connection.execute(text(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)"))
        await connection.execute(text(f"CREATE DATABASE {name}"))
    await engine.dispose()


@pytest.fixture(scope="session")
async def engine(migrated_database: str) -> AsyncGenerator[AsyncEngine]:
    engine = create_async_engine(migrated_database, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession]:
    """A session inside a transaction that is rolled back after the test.

    The code under test commits and rolls back savepoints, never the outer transaction.
    """
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        yield session
        await session.close()
        await transaction.rollback()


class FakeYahoo(YahooClient):
    """Answers `search` with `results`, `get_details` from `details` and `get_history` from
    `histories`, or raises `failure`. `get_recent_bars` is the real one, over `get_history`."""

    def __init__(self) -> None:
        self.results: list[SearchResult] = []
        self.details: dict[str, ListingDetails] = {}
        self.histories: dict[str, PriceHistory] = {}
        # Symbols whose history raises ProviderUnavailableError.
        self.unavailable: set[str] = set()
        # (symbol, start) of each get_history call; start is None for a full history.
        self.history_requests: list[tuple[str, dt.date | None]] = []
        self.failure: Exception | None = None
        self.queries: list[str] = []
        self.details_requested: list[str] = []
        # Awaited by get_details before it answers, as if another request ran meanwhile.
        self.while_fetching_details: Callable[[], Awaitable[object]] | None = None

    async def search(self, query: str) -> list[SearchResult]:
        self.queries.append(query)
        if self.failure is not None:
            raise self.failure
        return self.results

    async def get_details(self, yahoo_symbol: str) -> ListingDetails | None:
        self.details_requested.append(yahoo_symbol)
        if self.while_fetching_details is not None:
            await self.while_fetching_details()
        if self.failure is not None:
            raise self.failure
        return self.details.get(yahoo_symbol)

    async def get_history(self, yahoo_symbol: str, start: dt.date | None = None) -> PriceHistory:
        self.history_requests.append((yahoo_symbol, start))
        if self.failure is not None:
            raise self.failure
        if yahoo_symbol in self.unavailable:
            raise ProviderUnavailableError("Yahoo Finance is unavailable. Try again later.")
        history = self.histories.get(yahoo_symbol, PriceHistory(bars=[], splits=[]))
        bars = [bar for bar in history.bars if start is None or bar.date >= start]
        return PriceHistory(bars=bars, splits=history.splits)


class FakeOpenFigi(OpenFigiClient):
    """Answers `get_share_class_figi` from `figis`, or raises `failure`; records each symbol."""

    def __init__(self) -> None:
        self.figis: dict[str, str] = {}
        self.failure: Exception | None = None
        self.symbols: list[str] = []

    async def get_share_class_figi(self, yahoo_symbol: str) -> str | None:
        self.symbols.append(yahoo_symbol)
        if self.failure is not None:
            raise self.failure
        return self.figis.get(yahoo_symbol)


@pytest.fixture
def yahoo() -> FakeYahoo:
    """The Yahoo client the app uses in tests: no test reaches the real Yahoo."""
    return FakeYahoo()


@pytest.fixture
def openfigi() -> FakeOpenFigi:
    """The OpenFIGI client the app uses in tests: no test reaches the real OpenFIGI."""
    return FakeOpenFigi()


@pytest.fixture
def app(db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: db_session
    app.dependency_overrides[get_yahoo_client] = lambda: yahoo
    app.dependency_overrides[get_openfigi_client] = lambda: openfigi
    return app


# https, so the client's cookie jar sends back Secure cookies such as the refresh token.
BASE_URL = "https://test"


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        yield client


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    return await create_user(
        db_session, UserCreate(email="user@example.com", password="fixture password 123")
    )


@pytest.fixture
async def other_user(db_session: AsyncSession) -> User:
    """A second user, whose rows `user` must never see."""
    return await create_user(
        db_session, UserCreate(email="other@example.com", password="fixture password 456")
    )


@pytest.fixture
async def auth_client(app: FastAPI, user: User) -> AsyncGenerator[AsyncClient]:
    """A client that sends a valid access token for `user`."""
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL, headers=headers
    ) as client:
        yield client


class InstrumentFactory(Protocol):
    async def __call__(
        self,
        yahoo_symbol: str = ...,
        *,
        type: InstrumentType = ...,
        name: str = ...,
        exchange_code: str = ...,
        currency: str = ...,
        isin: str | None = ...,
        share_class_figi: str | None = ...,
    ) -> Instrument: ...


@pytest.fixture
def make_instrument(db_session: AsyncSession) -> InstrumentFactory:
    """A function that inserts an instrument; each argument overrides one default column."""

    async def make(
        yahoo_symbol: str = "AAPL",
        *,
        type: InstrumentType = InstrumentType.STOCK,
        name: str = "Apple Inc.",
        exchange_code: str = "NMS",
        currency: str = "USD",
        isin: str | None = None,
        share_class_figi: str | None = None,
    ) -> Instrument:
        instrument = Instrument(
            type=type,
            name=name,
            yahoo_symbol=yahoo_symbol,
            exchange_code=exchange_code,
            currency=currency,
            isin=isin,
            share_class_figi=share_class_figi,
        )
        db_session.add(instrument)
        await db_session.commit()
        await db_session.refresh(instrument)
        return instrument

    return make


class PortfolioFactory(Protocol):
    async def __call__(self, owner: User, name: str = ...) -> Portfolio: ...


@pytest.fixture
def make_portfolio(db_session: AsyncSession) -> PortfolioFactory:
    """A function that inserts a portfolio owned by `owner`."""

    async def make(owner: User, name: str = "Long term") -> Portfolio:
        portfolio = Portfolio(user_id=owner.id, name=name)
        db_session.add(portfolio)
        await db_session.commit()
        await db_session.refresh(portfolio)
        return portfolio

    return make


class PositionFactory(Protocol):
    async def __call__(
        self,
        portfolio: Portfolio,
        instrument: Instrument,
        *,
        quantity: Decimal | None = ...,
        average_price: Decimal | None = ...,
    ) -> Position: ...


@pytest.fixture
def make_position(db_session: AsyncSession) -> PositionFactory:
    """A function that inserts a position of `instrument` in `portfolio`."""

    async def make(
        portfolio: Portfolio,
        instrument: Instrument,
        *,
        quantity: Decimal | None = None,
        average_price: Decimal | None = None,
    ) -> Position:
        position = Position(
            portfolio_id=portfolio.id,
            instrument_id=instrument.id,
            quantity=quantity,
            average_price=average_price,
        )
        db_session.add(position)
        await db_session.commit()
        await db_session.refresh(position)
        return position

    return make


class DailyPriceFactory(Protocol):
    async def __call__(
        self, instrument: Instrument, date: dt.date, *, close: Decimal = ...
    ) -> DailyPrice: ...


@pytest.fixture
def make_daily_price(db_session: AsyncSession) -> DailyPriceFactory:
    """A function that inserts the bar of `instrument` on `date`; every price is `close`."""

    async def make(
        instrument: Instrument, date: dt.date, *, close: Decimal = Decimal(100)
    ) -> DailyPrice:
        price = DailyPrice(
            instrument_id=instrument.id,
            date=date,
            open=close,
            high=close,
            low=close,
            close=close,
            adj_close=close,
            volume=1000,
        )
        db_session.add(price)
        await db_session.commit()
        await db_session.refresh(price)
        return price

    return make
