import datetime as dt
from decimal import Decimal

import pytest
from conftest import DailyPriceFactory, FxRateFactory, InstrumentFactory, PositionFactory
from httpx2 import AsyncClient

from app.modules.instruments.models import Instrument
from app.modules.portfolios.models import Portfolio

pytestmark = pytest.mark.anyio

URL = "/api/v1/portfolio/overview"
DAY = dt.date(2026, 11, 6)
PREVIOUS_DAY = dt.date(2026, 11, 5)


def figures(item: dict[str, object]) -> dict[str, object]:
    """A position of the overview without the nested position."""
    return {key: value for key, value in item.items() if key != "position"}


async def add_closes(
    make_daily_price: DailyPriceFactory, instrument: Instrument, previous: str, latest: str
) -> None:
    await make_daily_price(instrument, PREVIOUS_DAY, close=Decimal(previous))
    await make_daily_price(instrument, DAY, close=Decimal(latest))


async def add_valued_position(
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    """A EUR position worth 500.00, up 50.00 on the day and 100.00 on its cost."""
    instrument = await make_instrument("MC.PA", currency="EUR")
    await make_position(portfolio, instrument, quantity=Decimal(10), average_price=Decimal(40))
    await add_closes(make_daily_price, instrument, "45", "50")


# The totals of `add_valued_position` alone.
VALUED_TOTALS = {
    "base_currency": "EUR",
    "value_base": "500.00",
    "day_change_base": "50.00",
    "day_change_base_pct": "11.11",
    "unrealised_gain_base": "100.00",
    "unrealised_gain_base_pct": "25.00",
    "positions": 2,
    "valued_positions": 1,
    "prices_as_of": "2026-11-06",
}


async def test_overview_values_positions_in_two_currencies(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    make_fx_rate: FxRateFactory,
    portfolio: Portfolio,
) -> None:
    lvmh = await make_instrument("MC.PA", currency="EUR")
    nvidia = await make_instrument("NVDA", currency="USD")
    nvidia_position = await make_position(
        portfolio, nvidia, quantity=Decimal(6), average_price=Decimal("164.20")
    )
    lvmh_position = await make_position(
        portfolio, lvmh, quantity=Decimal(4), average_price=Decimal("612.30")
    )
    await make_daily_price(lvmh, dt.date(2026, 11, 4), close=Decimal(999))
    await add_closes(make_daily_price, lvmh, "593.20", "586.10")
    await add_closes(make_daily_price, nvidia, "196.25", "200.00")
    await make_fx_rate("USD", PREVIOUS_DAY, Decimal("0.95"))
    await make_fx_rate("USD", DAY, Decimal("0.9213"))
    await make_fx_rate("USD", DAY + dt.timedelta(days=1), Decimal("0.80"))

    response = await auth_client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert [item["position"]["id"] for item in body["positions"]] == [
        str(lvmh_position.id),
        str(nvidia_position.id),
    ]
    assert body["positions"][0]["position"]["instrument"]["yahoo_symbol"] == "MC.PA"
    assert [figures(item) for item in body["positions"]] == [
        {
            "latest_close": "586.100000",
            "latest_close_date": "2026-11-06",
            "previous_close": "593.200000",
            "day_change": "-28.40",
            "day_change_pct": "-1.20",
            "value": "2344.40",
            "value_base": "2344.40",
            "unrealised_gain": "-104.80",
            "unrealised_gain_pct": "-4.28",
            "weight": "67.95",
        },
        {
            "latest_close": "200.000000",
            "latest_close_date": "2026-11-06",
            "previous_close": "196.250000",
            "day_change": "22.50",
            "day_change_pct": "1.91",
            "value": "1200.00",
            "value_base": "1105.56",
            "unrealised_gain": "214.80",
            "unrealised_gain_pct": "21.80",
            "weight": "32.05",
        },
    ]
    assert body["totals"] == {
        "base_currency": "EUR",
        "value_base": "3449.96",
        "day_change_base": "-7.67",
        "day_change_base_pct": "-0.22",
        "unrealised_gain_base": "93.10",
        "unrealised_gain_base_pct": "2.77",
        "positions": 2,
        "valued_positions": 2,
        "prices_as_of": "2026-11-06",
        "unvalued": [],
    }


async def test_overview_shows_the_price_of_a_position_without_quantity_but_no_value(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    await add_valued_position(make_instrument, make_position, make_daily_price, portfolio)
    apple = await make_instrument("AAPL", currency="USD")
    position = await make_position(portfolio, apple, average_price=Decimal(90))
    await add_closes(make_daily_price, apple, "100", "110")

    response = await auth_client.get(URL)

    body = response.json()
    assert body["positions"][1]["position"]["id"] == str(position.id)
    assert figures(body["positions"][1]) == {
        "latest_close": "110.000000",
        "latest_close_date": "2026-11-06",
        "previous_close": "100.000000",
        "day_change": None,
        "day_change_pct": "10.00",
        "value": None,
        "value_base": None,
        "unrealised_gain": None,
        "unrealised_gain_pct": None,
        "weight": None,
    }
    assert body["totals"] == {
        **VALUED_TOTALS,
        "unvalued": [{"position_id": str(position.id), "reason": "no_quantity"}],
    }


async def test_overview_values_a_position_without_average_price_but_gives_no_gain(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    await add_valued_position(make_instrument, make_position, make_daily_price, portfolio)
    total = await make_instrument("TTE.PA", currency="EUR")
    position = await make_position(portfolio, total, quantity=Decimal(2))
    await add_closes(make_daily_price, total, "20", "25")

    response = await auth_client.get(URL)

    body = response.json()
    assert body["positions"][1]["position"]["id"] == str(position.id)
    assert figures(body["positions"][1]) == {
        "latest_close": "25.000000",
        "latest_close_date": "2026-11-06",
        "previous_close": "20.000000",
        "day_change": "10.00",
        "day_change_pct": "25.00",
        "value": "50.00",
        "value_base": "50.00",
        "unrealised_gain": None,
        "unrealised_gain_pct": None,
        "weight": "9.09",
    }
    assert body["positions"][0]["weight"] == "90.91"
    # Value and day change cover both positions, the gain only the one with a cost.
    assert body["totals"] == {
        **VALUED_TOTALS,
        "value_base": "550.00",
        "day_change_base": "60.00",
        "day_change_base_pct": "12.24",
        "valued_positions": 2,
        "unvalued": [],
    }


async def test_overview_reports_a_position_without_price_as_unvalued(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    await add_valued_position(make_instrument, make_position, make_daily_price, portfolio)
    asml = await make_instrument("ASML.AS", currency="EUR")
    position = await make_position(portfolio, asml, quantity=Decimal(3), average_price=Decimal(600))

    response = await auth_client.get(URL)

    body = response.json()
    assert body["positions"][1]["position"]["id"] == str(position.id)
    assert set(figures(body["positions"][1]).values()) == {None}
    assert body["totals"] == {
        **VALUED_TOTALS,
        "unvalued": [{"position_id": str(position.id), "reason": "no_price"}],
    }


async def test_overview_reports_a_position_without_rate_as_unvalued(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    make_fx_rate: FxRateFactory,
    portfolio: Portfolio,
) -> None:
    await add_valued_position(make_instrument, make_position, make_daily_price, portfolio)
    apple = await make_instrument("AAPL", currency="USD")
    position = await make_position(
        portfolio, apple, quantity=Decimal(2), average_price=Decimal(100)
    )
    await add_closes(make_daily_price, apple, "100", "110")
    await make_fx_rate("USD", DAY + dt.timedelta(days=1), Decimal("0.9"))

    response = await auth_client.get(URL)

    body = response.json()
    assert body["positions"][1]["position"]["id"] == str(position.id)
    assert figures(body["positions"][1]) == {
        "latest_close": "110.000000",
        "latest_close_date": "2026-11-06",
        "previous_close": "100.000000",
        "day_change": "20.00",
        "day_change_pct": "10.00",
        "value": "220.00",
        "value_base": None,
        "unrealised_gain": "20.00",
        "unrealised_gain_pct": "10.00",
        "weight": None,
    }
    assert body["totals"] == {
        **VALUED_TOTALS,
        "unvalued": [{"position_id": str(position.id), "reason": "no_rate"}],
    }


async def test_overview_of_a_position_with_one_close_has_no_day_change(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    instrument = await make_instrument("MC.PA", currency="EUR")
    await make_position(portfolio, instrument, quantity=Decimal(2), average_price=Decimal(10))
    await make_daily_price(instrument, DAY, close=Decimal(12))

    response = await auth_client.get(URL)

    body = response.json()
    assert figures(body["positions"][0]) == {
        "latest_close": "12.000000",
        "latest_close_date": "2026-11-06",
        "previous_close": None,
        "day_change": None,
        "day_change_pct": None,
        "value": "24.00",
        "value_base": "24.00",
        "unrealised_gain": "4.00",
        "unrealised_gain_pct": "20.00",
        "weight": "100.00",
    }
    assert body["totals"]["day_change_base"] is None
    assert body["totals"]["day_change_base_pct"] is None
    assert body["totals"]["valued_positions"] == 1


async def test_overview_rounds_halves_up_and_never_to_negative_zero(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
) -> None:
    instrument = await make_instrument("MC.PA", currency="EUR")
    await make_position(portfolio, instrument, quantity=Decimal(1), average_price=Decimal("10.006"))
    await add_closes(make_daily_price, instrument, "10.006", "10.005")

    response = await auth_client.get(URL)

    item = response.json()["positions"][0]
    assert item["value"] == "10.01"
    assert item["day_change"] == "0.00"
    assert item["unrealised_gain"] == "0.00"
    assert item["unrealised_gain_pct"] == "-0.01"


async def test_overview_leaves_out_other_users_positions(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_daily_price: DailyPriceFactory,
    portfolio: Portfolio,
    other_portfolio: Portfolio,
) -> None:
    instrument = await make_instrument("MC.PA", currency="EUR")
    await make_position(other_portfolio, instrument, quantity=Decimal(4))
    await make_daily_price(instrument, DAY, close=Decimal(500))

    response = await auth_client.get(URL)

    body = response.json()
    assert body["positions"] == []
    assert body["totals"]["positions"] == 0
    assert body["totals"]["value_base"] is None


async def test_overview_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(URL)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_overview_of_an_empty_portfolio_has_no_totals(
    auth_client: AsyncClient, portfolio: Portfolio
) -> None:
    response = await auth_client.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "positions": [],
        "totals": {
            "base_currency": "EUR",
            "value_base": None,
            "day_change_base": None,
            "day_change_base_pct": None,
            "unrealised_gain_base": None,
            "unrealised_gain_base_pct": None,
            "positions": 0,
            "valued_positions": 0,
            "prices_as_of": None,
            "unvalued": [],
        },
    }
