import datetime as dt
import itertools
import uuid
from collections.abc import Awaitable, Sequence

import structlog
from sqlalchemy import Row, exists, select
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.schemas import DailyBar
from app.modules.instruments.models import Instrument
from app.modules.instruments.service import followed_instrument_ids, get_instrument
from app.modules.prices.models import DailyPrice
from app.modules.prices.schemas import PriceUpdateSummary

logger = structlog.stdlib.get_logger(__name__)

# Rows sent per statement; a full history can exceed 10,000.
BATCH_SIZE = 1000
PRICE_COLUMNS = ["open", "high", "low", "close", "adj_close", "volume"]
# Calendar days fetched for an instrument that already has prices.
RECENT_DAYS = 5
NO_RECENT_BARS = f"Yahoo Finance has no bar for the last {RECENT_DAYS} days."
NOT_STORED = "Its prices could not be stored."


async def backfill(session: AsyncSession, yahoo: YahooClient, instrument_id: uuid.UUID) -> int:
    """Store the instrument's full daily history from Yahoo; return the number of bars."""
    instrument = await get_instrument(session, instrument_id)
    # Ends the read's transaction, so none stays open while Yahoo answers.
    await session.commit()

    history = await yahoo.get_history(instrument.yahoo_symbol)

    # One transaction: the history is stored whole or not at all.
    await _store(session, instrument.id, history.bars)
    await session.commit()
    return len(history.bars)


async def update_prices(session: AsyncSession, yahoo: YahooClient) -> PriceUpdateSummary:
    """Bring the prices of every instrument held in a portfolio or on a watchlist up to date.

    An instrument without prices, or with a split in its recent bars, gets its full history;
    the others get their recent bars. One instrument failing does not stop the others.
    """
    followed = await _followed_instruments(session)
    await session.commit()

    backfilled: list[str] = []
    updated: list[str] = []
    failed: dict[str, str] = {}

    # No prices yet means a full history is needed.
    to_backfill = {symbol: id_ for id_, symbol, has_prices in followed if not has_prices}
    to_update = {symbol: id_ for id_, symbol, has_prices in followed if has_prices}

    # Fetch of the recent bars of every instrument that has prices.
    recent = await yahoo.get_recent_bars(list(to_update), days=RECENT_DAYS)
    failed.update(recent.failed)
    # Every missing symbol gets the same reason.
    failed.update(dict.fromkeys(recent.missing, NO_RECENT_BARS))
    for symbol, history in recent.histories.items():
        # Yahoo adjusts every close before a split, so the stored ones are stale.
        if history.splits:
            to_backfill[symbol] = to_update[symbol]
            continue
        # Otherwise store the recent bars, each instrument in its own transaction.
        error = await _attempt(session, _store_and_commit(session, to_update[symbol], history.bars))
        if error is None:
            updated.append(symbol)
        else:
            failed[symbol] = error

    # Full histories, one instrument at a time: new instruments, then those with a split.
    for symbol, instrument_id in to_backfill.items():
        error = await _attempt(session, backfill(session, yahoo, instrument_id))
        if error is None:
            backfilled.append(symbol)
        else:
            failed[symbol] = error

    summary = PriceUpdateSummary(backfilled=backfilled, updated=updated, failed=failed)
    logger.info("prices.update_finished", **summary.model_dump())
    return summary


async def list_prices(
    session: AsyncSession, instrument_id: uuid.UUID, start: dt.date, end: dt.date
) -> Sequence[DailyPrice]:
    """The instrument's bars from `start` to `end` included, oldest first."""
    await get_instrument(session, instrument_id)

    statement = (
        select(DailyPrice)
        .where(DailyPrice.instrument_id == instrument_id, DailyPrice.date.between(start, end))
        .order_by(DailyPrice.date)
    )
    return (await session.scalars(statement)).all()


async def _followed_instruments(
    session: AsyncSession,
) -> Sequence[Row[uuid.UUID, str, bool]]:
    """The id and Yahoo symbol of every instrument in a position or on a watchlist, once, and
    whether it has stored prices.

    Plain values, not ORM objects: a rollback after a failure expires those.
    """
    has_prices = exists().where(DailyPrice.instrument_id == Instrument.id)
    statement = (
        select(Instrument.id, Instrument.yahoo_symbol, has_prices)
        .where(Instrument.id.in_(followed_instrument_ids()))
        .order_by(Instrument.yahoo_symbol)
    )
    return (await session.execute(statement)).all()


async def _attempt(session: AsyncSession, work: Awaitable[object]) -> str | None:
    """Await `work`; if Yahoo or the database fails, roll back and return why."""
    try:
        await work
    except ProviderUnavailableError as exc:
        await session.rollback()
        return exc.message
    except DBAPIError as exc:
        await session.rollback()
        logger.warning("prices.store_failed", error=repr(exc.orig))
        return NOT_STORED
    return None


async def _store_and_commit(
    session: AsyncSession, instrument_id: uuid.UUID, bars: Sequence[DailyBar]
) -> None:
    await _store(session, instrument_id, bars)
    await session.commit()


async def _store(session: AsyncSession, instrument_id: uuid.UUID, bars: Sequence[DailyBar]) -> None:
    """Upsert the bars, in batches of BATCH_SIZE."""
    rows = [{"instrument_id": instrument_id, **bar.model_dump()} for bar in bars]
    for batch in itertools.batched(rows, BATCH_SIZE, strict=False):
        await session.execute(_upsert(), batch)


def _upsert() -> Insert:
    statement = insert(DailyPrice)
    # `excluded` is the row that failed to insert: its values replace the stored ones.
    return statement.on_conflict_do_update(
        index_elements=[DailyPrice.instrument_id, DailyPrice.date],
        set_={column: statement.excluded[column] for column in PRICE_COLUMNS},
    )
