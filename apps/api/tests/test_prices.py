import datetime as dt
import uuid
from decimal import Decimal

import pytest
from conftest import DailyPriceFactory, FakeYahoo, InstrumentFactory
from httpx2 import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ProviderUnavailableError
from app.integrations.yahoo.schemas import DailyBar, PriceHistory
from app.modules.instruments.models import Instrument
from app.modules.prices.models import DailyPrice
from app.modules.prices.service import BATCH_SIZE, backfill

pytestmark = pytest.mark.anyio

START = dt.date(1990, 1, 1)


def prices_url(instrument_id: uuid.UUID) -> str:
    return f"/api/v1/instruments/{instrument_id}/prices"


def bar(date: dt.date, close: str = "100.5") -> DailyBar:
    return DailyBar(
        date=date,
        open=Decimal("99.25"),
        high=Decimal("101"),
        low=Decimal("98.75"),
        close=Decimal(close),
        adj_close=Decimal("90.123456"),
        volume=1_000_000,
    )


def history(days: int) -> PriceHistory:
    return PriceHistory(
        bars=[bar(START + dt.timedelta(days=day)) for day in range(days)], splits=[]
    )


async def stored_prices(db_session: AsyncSession) -> list[DailyPrice]:
    return list(await db_session.scalars(select(DailyPrice).order_by(DailyPrice.date)))


async def test_backfill_stores_every_bar_of_the_history(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")
    yahoo.histories["AAPL"] = history(3)

    count = await backfill(db_session, yahoo, instrument.id)

    assert count == 3
    prices = await stored_prices(db_session)
    assert [price.date for price in prices] == [START + dt.timedelta(days=day) for day in range(3)]
    first = prices[0]
    assert first.instrument_id == instrument.id
    assert (first.open, first.high, first.low, first.close, first.adj_close, first.volume) == (
        Decimal("99.25"),
        Decimal(101),
        Decimal("98.75"),
        Decimal("100.5"),
        Decimal("90.123456"),
        1_000_000,
    )


async def test_backfill_stores_a_history_longer_than_one_batch(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")
    yahoo.histories["AAPL"] = history(2 * BATCH_SIZE + 1)

    await backfill(db_session, yahoo, instrument.id)

    count = await db_session.scalar(select(func.count()).select_from(DailyPrice))
    assert count == 2 * BATCH_SIZE + 1


async def test_backfill_run_twice_leaves_one_row_per_day(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")
    yahoo.histories["AAPL"] = history(3)

    await backfill(db_session, yahoo, instrument.id)
    await backfill(db_session, yahoo, instrument.id)

    assert len(await stored_prices(db_session)) == 3


async def test_backfill_replaces_bars_yahoo_has_revised(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")
    yahoo.histories["AAPL"] = PriceHistory(bars=[bar(START, close="100")], splits=[])
    await backfill(db_session, yahoo, instrument.id)
    yahoo.histories["AAPL"] = PriceHistory(
        bars=[bar(START, close="25"), bar(START + dt.timedelta(days=1))], splits=[]
    )

    await backfill(db_session, yahoo, instrument.id)

    prices = await stored_prices(db_session)
    assert [price.close for price in prices] == [Decimal(25), Decimal("100.5")]


async def test_backfill_leaves_other_instruments_bars_alone(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    make_instrument: InstrumentFactory,
    make_daily_price: DailyPriceFactory,
) -> None:
    other = await make_instrument("MSFT", name="Microsoft Corporation")
    await make_daily_price(other, START, close=Decimal(400))
    instrument = await make_instrument("AAPL")
    yahoo.histories["AAPL"] = history(1)

    await backfill(db_session, yahoo, instrument.id)

    prices = await stored_prices(db_session)
    assert {(price.instrument_id, price.close) for price in prices} == {
        (other.id, Decimal(400)),
        (instrument.id, Decimal("100.5")),
    }


async def test_backfill_of_an_instrument_without_history_stores_nothing(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")

    assert await backfill(db_session, yahoo, instrument.id) == 0
    assert await stored_prices(db_session) == []


async def test_backfill_of_an_unknown_instrument_raises_not_found(
    db_session: AsyncSession, yahoo: FakeYahoo
) -> None:
    with pytest.raises(NotFoundError):
        await backfill(db_session, yahoo, uuid.uuid4())


async def test_backfill_while_yahoo_is_down_raises_and_stores_nothing(
    db_session: AsyncSession, yahoo: FakeYahoo, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument("AAPL")
    yahoo.failure = ProviderUnavailableError("Yahoo Finance is unavailable. Try again later.")

    with pytest.raises(ProviderUnavailableError):
        await backfill(db_session, yahoo, instrument.id)
    assert await stored_prices(db_session) == []


async def test_deleting_an_instrument_deletes_its_prices(
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await make_instrument()
    await make_daily_price(instrument, START)

    await db_session.execute(delete(Instrument).where(Instrument.id == instrument.id))

    assert await stored_prices(db_session) == []


async def test_list_prices_returns_the_range_oldest_first_both_ends_included(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await make_instrument()
    other = await make_instrument("MSFT", name="Microsoft Corporation")
    for day in [5, 1, 3, 2, 4]:
        await make_daily_price(instrument, dt.date(2024, 1, day))
    await make_daily_price(other, dt.date(2024, 1, 3))

    response = await auth_client.get(
        prices_url(instrument.id), params={"from": "2024-01-02", "to": "2024-01-04"}
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["date"] for item in items] == ["2024-01-02", "2024-01-03", "2024-01-04"]
    assert items[0] == {
        "date": "2024-01-02",
        "open": "100.000000",
        "high": "100.000000",
        "low": "100.000000",
        "close": "100.000000",
        "adj_close": "100.000000",
        "volume": 1000,
    }


async def test_list_prices_defaults_to_the_last_year(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await make_instrument()
    today = dt.date.today()
    for days_ago in [0, 365, 366]:
        await make_daily_price(instrument, today - dt.timedelta(days=days_ago))

    response = await auth_client.get(prices_url(instrument.id))

    dates = [item["date"] for item in response.json()["items"]]
    assert dates == [str(today - dt.timedelta(days=365)), str(today)]


async def test_list_prices_with_only_to_returns_the_year_before_it(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_daily_price: DailyPriceFactory,
) -> None:
    instrument = await make_instrument()
    for date in [dt.date(2022, 6, 1), dt.date(2023, 6, 1), dt.date(2023, 6, 2)]:
        await make_daily_price(instrument, date)

    response = await auth_client.get(prices_url(instrument.id), params={"to": "2023-06-01"})

    dates = [item["date"] for item in response.json()["items"]]
    assert dates == ["2022-06-01", "2023-06-01"]


@pytest.mark.parametrize(
    ("params", "message"),
    [
        ({"from": "2015-01-01", "to": "2024-01-01"}, "The range cannot span more than 1830 days."),
        ({"from": "2024-02-01", "to": "2024-01-01"}, "`from` must not be after `to`."),
    ],
)
async def test_list_prices_rejects_a_range_too_long_or_reversed(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    params: dict[str, str],
    message: str,
) -> None:
    instrument = await make_instrument()

    response = await auth_client.get(prices_url(instrument.id), params=params)

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["query", "from"]
    assert response.json()["details"][0]["message"] == message


async def test_list_prices_accepts_the_longest_range(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument()

    response = await auth_client.get(
        prices_url(instrument.id), params={"from": "2020-01-01", "to": "2025-01-01"}
    )

    assert response.status_code == 200


async def test_list_prices_of_an_unknown_instrument_answers_404(
    auth_client: AsyncClient,
) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.get(prices_url(instrument_id))

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument_id} not found."


async def test_list_prices_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(prices_url(uuid.UUID(int=0)))

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
