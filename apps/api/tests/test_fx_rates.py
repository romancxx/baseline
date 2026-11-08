import datetime as dt
from decimal import Decimal

import pytest
from conftest import FakeYahoo, FxRateFactory, InstrumentFactory, PositionFactory
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.yahoo.schemas import DailyBar, PriceHistory
from app.modules.portfolios.models import Portfolio
from app.modules.prices.models import FxRate
from app.modules.prices.schemas import RateUpdateSummary
from app.modules.prices.service import NO_RECENT_BARS, MissingRateError, convert, update_rates

pytestmark = pytest.mark.anyio

DAY = dt.date(2026, 11, 2)


def days_ago(days: int) -> dt.date:
    return dt.date.today() - dt.timedelta(days=days)


def rate_history(date: dt.date, rate: str) -> PriceHistory:
    """Yahoo's history of an FX symbol: one day whose prices are all `rate`."""
    value = Decimal(rate)
    bar = DailyBar(
        date=date, open=value, high=value, low=value, close=value, adj_close=value, volume=0
    )
    return PriceHistory(bars=[bar], splits=[])


async def test_update_rates_fetches_only_the_currencies_held_but_the_base(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    for symbol, currency in [("AAPL", "USD"), ("AZN.L", "GBP"), ("VOD.L", "GBP"), ("MC.PA", "EUR")]:
        await make_position(portfolio, await make_instrument(symbol, currency=currency))
    await make_instrument("7203.T", currency="JPY")
    yahoo.histories["GBPEUR=X"] = rate_history(days_ago(1), "1.19880")
    yahoo.histories["USDEUR=X"] = rate_history(days_ago(1), "0.8969")

    summary = await update_rates(db_session, yahoo)

    assert summary == RateUpdateSummary(updated=["GBP", "USD"], failed={})
    assert yahoo.history_requests == [("GBPEUR=X", days_ago(5)), ("USDEUR=X", days_ago(5))]
    rates = await db_session.scalars(select(FxRate).order_by(FxRate.currency))
    assert [(rate.currency, rate.date, rate.rate) for rate in rates] == [
        ("GBP", days_ago(1), Decimal("1.1988")),
        ("USD", days_ago(1), Decimal("0.8969")),
    ]


async def test_update_rates_reports_a_currency_without_recent_rates(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    await make_position(portfolio, await make_instrument("AAPL", currency="USD"))

    summary = await update_rates(db_session, yahoo)

    assert summary == RateUpdateSummary(updated=[], failed={"USD": NO_RECENT_BARS})


async def test_convert_uses_the_latest_rate_on_or_before_the_date(
    db_session: AsyncSession, make_fx_rate: FxRateFactory
) -> None:
    await make_fx_rate("USD", DAY - dt.timedelta(days=5), Decimal("0.9"))
    await make_fx_rate("USD", DAY - dt.timedelta(days=2), Decimal("0.8"))
    await make_fx_rate("USD", DAY + dt.timedelta(days=1), Decimal("0.7"))

    assert await convert(db_session, Decimal(100), "USD", DAY) == Decimal(80)


async def test_convert_from_the_base_currency_returns_the_amount(
    db_session: AsyncSession,
) -> None:
    assert await convert(db_session, Decimal("123.45"), "EUR", DAY) == Decimal("123.45")


async def test_convert_without_a_rate_on_or_before_the_date_raises(
    db_session: AsyncSession, make_fx_rate: FxRateFactory
) -> None:
    await make_fx_rate("USD", DAY + dt.timedelta(days=1), Decimal("0.9"))

    with pytest.raises(MissingRateError, match="No USD to EUR rate on or before 2026-11-02."):
        await convert(db_session, Decimal(100), "USD", DAY)
