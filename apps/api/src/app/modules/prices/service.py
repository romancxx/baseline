import datetime as dt
import itertools
import uuid
from collections.abc import Awaitable, Sequence
from decimal import Decimal

import structlog
from sqlalchemy import Row, exists, select
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.client import YahooClient, fx_symbol
from app.integrations.yahoo.schemas import DailyBar
from app.modules.instruments.models import Instrument
from app.modules.instruments.service import get_instrument
from app.modules.positions.service import followed_instrument_ids
from app.modules.prices.models import DailyPrice, FxRate
from app.modules.prices.schemas import PriceUpdateSummary, RateUpdateSummary

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
    """Bring the prices of every instrument held in a portfolio up to date.

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


async def update_rates(session: AsyncSession, yahoo: YahooClient) -> RateUpdateSummary:
    """Store the recent FX rates, into the base currency, of every currency held but the base.

    One currency failing does not stop the others.
    """
    currencies = await _held_currencies(session)
    await session.commit()

    base = get_settings().base_currency
    # Each currency by its FX symbol.
    by_symbol = {fx_symbol(currency, base): currency for currency in currencies if currency != base}
    updated: list[str] = []
    failed: dict[str, str] = {}

    recent = await yahoo.get_recent_bars(list(by_symbol), days=RECENT_DAYS)
    for symbol, reason in recent.failed.items():
        failed[by_symbol[symbol]] = reason
    for symbol in recent.missing:
        failed[by_symbol[symbol]] = NO_RECENT_BARS
    # Each currency in its own transaction.
    for symbol, history in recent.histories.items():
        currency = by_symbol[symbol]
        error = await _attempt(session, _store_rates_and_commit(session, currency, history.bars))
        if error is None:
            updated.append(currency)
        else:
            failed[currency] = error

    summary = RateUpdateSummary(updated=updated, failed=failed)
    logger.info("rates.update_finished", **summary.model_dump())
    return summary


async def get_rate(session: AsyncSession, currency: str, on_date: dt.date) -> Decimal | None:
    """Base-currency units per 1 `currency`, at the latest rate on or before `on_date`: 1 for the
    base currency itself, None when no rate of `currency` is stored on or before that date."""
    if currency == get_settings().base_currency:
        return Decimal(1)

    return await session.scalar(
        select(FxRate.rate)
        .where(FxRate.currency == currency, FxRate.date <= on_date)
        .order_by(FxRate.date.desc())
        .limit(1)
    )


async def _held_currencies(session: AsyncSession) -> Sequence[str]:
    """The currency of every instrument in a position, once, in alphabetical order."""
    statement = (
        select(Instrument.currency)
        .where(Instrument.id.in_(followed_instrument_ids()))
        .distinct()
        .order_by(Instrument.currency)
    )
    return (await session.scalars(statement)).all()


async def _followed_instruments(
    session: AsyncSession,
) -> Sequence[Row[uuid.UUID, str, bool]]:
    """The id and Yahoo symbol of every instrument in a position, once, and whether it has
    stored prices.

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


async def _store_rates_and_commit(
    session: AsyncSession, currency: str, bars: Sequence[DailyBar]
) -> None:
    """Upsert each bar's close as the currency's rate on its day."""
    statement = insert(FxRate)
    await session.execute(
        statement.on_conflict_do_update(
            index_elements=[FxRate.currency, FxRate.date],
            set_={"rate": statement.excluded.rate},
        ),
        [{"currency": currency, "date": bar.date, "rate": bar.close} for bar in bars],
    )
    await session.commit()


def _upsert() -> Insert:
    statement = insert(DailyPrice)
    # `excluded` is the row that failed to insert: its values replace the stored ones.
    return statement.on_conflict_do_update(
        index_elements=[DailyPrice.instrument_id, DailyPrice.date],
        set_={column: statement.excluded[column] for column in PRICE_COLUMNS},
    )
