import datetime as dt
import uuid
from decimal import Decimal
from typing import Protocol

import pytest
from conftest import (
    DailyPriceFactory,
    FakeYahoo,
    InstrumentFactory,
    PortfolioFactory,
    PositionFactory,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.integrations.yahoo.schemas import DailyBar, PriceHistory, Split
from app.modules.instruments.models import Instrument
from app.modules.prices.models import DailyPrice
from app.modules.prices.schemas import PriceUpdateSummary
from app.modules.prices.service import NO_RECENT_BARS, NOT_STORED, update_prices
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

UNAVAILABLE = "Yahoo Finance is unavailable. Try again later."


def days_ago(days: int) -> dt.date:
    return dt.date.today() - dt.timedelta(days=days)


def bar(date: dt.date, close: str = "100") -> DailyBar:
    price = Decimal(close)
    return DailyBar(
        date=date, open=price, high=price, low=price, close=price, adj_close=price, volume=1000
    )


def history(*bars: DailyBar, splits: list[Split] | None = None) -> PriceHistory:
    return PriceHistory(bars=list(bars), splits=splits or [])


class Follow(Protocol):
    async def __call__(self, yahoo_symbol: str) -> Instrument: ...


@pytest.fixture
async def follow(
    make_instrument: InstrumentFactory,
    make_portfolio: PortfolioFactory,
    make_position: PositionFactory,
    user: User,
) -> Follow:
    """A function that inserts an instrument held in a portfolio of `user`."""
    portfolio = await make_portfolio(user)

    async def make(yahoo_symbol: str) -> Instrument:
        instrument = await make_instrument(yahoo_symbol)
        await make_position(portfolio, instrument)
        return instrument

    return make


async def closes(db_session: AsyncSession, instrument_id: uuid.UUID) -> dict[dt.date, Decimal]:
    prices = await db_session.scalars(
        select(DailyPrice).where(DailyPrice.instrument_id == instrument_id)
    )
    return {price.date: price.close for price in prices}


async def test_update_prices_backfills_a_followed_instrument_without_prices(
    db_session: AsyncSession, yahoo: FakeYahoo, follow: Follow
) -> None:
    instrument = await follow("AAPL")
    yahoo.histories["AAPL"] = history(bar(dt.date(1990, 1, 2)), bar(days_ago(1)))

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(backfilled=["AAPL"], updated=[], failed={})
    assert yahoo.history_requests == [("AAPL", None)]
    assert set(await closes(db_session, instrument.id)) == {dt.date(1990, 1, 2), days_ago(1)}


async def test_update_prices_upserts_the_recent_bars_of_an_instrument_with_prices(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    follow: Follow,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await follow("AAPL")
    await make_daily_price(instrument, days_ago(30), close=Decimal(90))
    await make_daily_price(instrument, days_ago(2), close=Decimal(100))
    yahoo.histories["AAPL"] = history(bar(days_ago(2), "101"), bar(days_ago(1), "102"))

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(backfilled=[], updated=["AAPL"], failed={})
    assert yahoo.history_requests == [("AAPL", days_ago(5))]
    assert await closes(db_session, instrument.id) == {
        days_ago(30): Decimal(90),
        days_ago(2): Decimal(101),
        days_ago(1): Decimal(102),
    }


async def test_update_prices_backfills_again_an_instrument_with_a_recent_split(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    follow: Follow,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await follow("NVDA")
    await make_daily_price(instrument, days_ago(30), close=Decimal(1200))
    # After a 10-for-1 split, Yahoo divides every earlier close by 10.
    yahoo.histories["NVDA"] = history(
        bar(days_ago(30), "120"),
        bar(days_ago(1), "121"),
        splits=[Split(date=days_ago(1), ratio=Decimal(10))],
    )

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(backfilled=["NVDA"], updated=[], failed={})
    assert yahoo.history_requests == [("NVDA", days_ago(5)), ("NVDA", None)]
    assert await closes(db_session, instrument.id) == {
        days_ago(30): Decimal(120),
        days_ago(1): Decimal(121),
    }


async def test_update_prices_ignores_instruments_no_portfolio_holds(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    await make_instrument("AAPL")
    yahoo.histories["AAPL"] = history(bar(days_ago(1)))

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(backfilled=[], updated=[], failed={})
    assert yahoo.history_requests == []


async def test_update_prices_fetches_an_instrument_held_in_several_portfolios_once(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    make_instrument: InstrumentFactory,
    make_portfolio: PortfolioFactory,
    make_position: PositionFactory,
    user: User,
    other_user: User,
) -> None:
    instrument = await make_instrument("AAPL")
    await make_position(await make_portfolio(user), instrument)
    await make_position(await make_portfolio(other_user), instrument)
    yahoo.histories["AAPL"] = history(bar(days_ago(1)))

    summary = await update_prices(db_session, yahoo)

    assert summary.backfilled == ["AAPL"]
    assert yahoo.history_requests == [("AAPL", None)]


async def test_update_prices_reports_failing_symbols_and_stores_the_others(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    follow: Follow,
    make_daily_price: DailyPriceFactory,
) -> None:
    new = await follow("NEW")
    new_down = await follow("NEWDOWN")
    known = await follow("KNOWN")
    known_down = await follow("KNOWNDOWN")
    for instrument in [known, known_down]:
        await make_daily_price(instrument, days_ago(30))
    for symbol in ["NEW", "KNOWN"]:
        yahoo.histories[symbol] = history(bar(days_ago(1)))
    yahoo.unavailable = {"NEWDOWN", "KNOWNDOWN"}

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(
        backfilled=["NEW"],
        updated=["KNOWN"],
        failed={"NEWDOWN": UNAVAILABLE, "KNOWNDOWN": UNAVAILABLE},
    )
    assert days_ago(1) in await closes(db_session, new.id)
    assert days_ago(1) in await closes(db_session, known.id)
    assert await closes(db_session, new_down.id) == {}


async def test_update_prices_reports_a_symbol_whose_prices_cannot_be_stored(
    db_session: AsyncSession, yahoo: FakeYahoo, follow: Follow
) -> None:
    await follow("HUGE")
    instrument = await follow("AAPL")
    # The service's rollback expires the session's objects, so read the id first.
    instrument_id = instrument.id
    # More integer digits than Numeric(18, 6) holds.
    yahoo.histories["HUGE"] = history(bar(days_ago(1), "1e13"))
    yahoo.histories["AAPL"] = history(bar(days_ago(1)))

    summary = await update_prices(db_session, yahoo)

    assert summary.failed == {"HUGE": NOT_STORED}
    assert summary.backfilled == ["AAPL"]
    assert days_ago(1) in await closes(db_session, instrument_id)


async def test_update_prices_reports_an_instrument_without_recent_bars(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    follow: Follow,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await follow("DELISTED")
    await make_daily_price(instrument, days_ago(30))

    summary = await update_prices(db_session, yahoo)

    assert summary == PriceUpdateSummary(
        backfilled=[], updated=[], failed={"DELISTED": NO_RECENT_BARS}
    )


async def test_update_prices_logs_one_line_with_the_summary(
    db_session: AsyncSession, yahoo: FakeYahoo, follow: Follow
) -> None:
    await follow("AAPL")
    await follow("MSFT")
    yahoo.histories["AAPL"] = history(bar(days_ago(1)))
    yahoo.unavailable = {"MSFT"}

    with capture_logs() as logs:
        await update_prices(db_session, yahoo)

    finished = [log for log in logs if log["event"] == "prices.update_finished"]
    assert finished == [
        {
            "event": "prices.update_finished",
            "log_level": "info",
            "backfilled": ["AAPL"],
            "updated": [],
            "failed": {"MSFT": UNAVAILABLE},
        }
    ]
