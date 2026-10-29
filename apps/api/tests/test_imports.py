import uuid
from decimal import Decimal

import pytest
from conftest import (
    FakeOpenFigi,
    FakeYahoo,
    InstrumentFactory,
    PortfolioFactory,
    PositionFactory,
    details,
    listing,
)
from httpx2 import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.imports.service import MAX_FILE_SIZE
from app.modules.instruments.models import Instrument
from app.modules.positions.models import Position
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

LVMH = "FR0000121014"
MSCI_WORLD = "IE00B4L5Y983"
SP_500 = "IE00B5BMR087"
APPLE = "US0378331005"


def import_url(portfolio_id: uuid.UUID) -> str:
    return f"/api/v1/portfolios/{portfolio_id}/import"


def csv_file(*lines: str) -> dict[str, tuple[str, bytes, str]]:
    """The multipart `file` field of a CSV with these lines."""
    return {"file": ("positions.csv", "\n".join(lines).encode(), "text/csv")}


@pytest.fixture(autouse=True)
def listings(yahoo: FakeYahoo, openfigi: FakeOpenFigi) -> None:
    """OpenFIGI's listings of LVMH and two ETFs, with the currencies Yahoo gives them."""
    openfigi.listings[LVMH] = [
        listing("LVMHF", "US"),
        listing("MOH.DE", "GY"),
        listing("MC.PA", "FP"),
    ]
    openfigi.listings[MSCI_WORLD] = [
        listing("SWDA.L", "LN"),
        listing("IWDA.L", "LN"),
        listing("EUNL.DE", "GY"),
        listing("IWDA.AS", "NA"),
    ]
    openfigi.listings[SP_500] = [
        listing("CSPX.L", "LN"),
        listing("CSP1.L", "LN"),
        listing("SXR8.DE", "GY"),
        listing("CSPX.AS", "NA"),
    ]
    currencies = {
        "LVMHF": "USD",
        "MOH.DE": "EUR",
        "MC.PA": "EUR",
        "SWDA.L": "GBP",
        "IWDA.L": "USD",
        "EUNL.DE": "EUR",
        "IWDA.AS": "EUR",
        "CSPX.L": "USD",
        "CSP1.L": "GBP",
        "SXR8.DE": "EUR",
        "CSPX.AS": "EUR",
    }
    yahoo.details = {symbol: details(currency) for symbol, currency in currencies.items()}


async def count(db_session: AsyncSession, model: type[Instrument | Position]) -> int:
    return await db_session.scalar(select(func.count()).select_from(model)) or 0


async def test_import_reports_each_row_and_imports_the_valid_ones(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.post(
        import_url(portfolio.id),
        files=csv_file(
            "isin,quantity,average_price,currency",
            f"{LVMH},10,650.5,EUR",
            "FR0000121015,1,,",
            f"{MSCI_WORLD},-3,,",
            f"{LVMH},5,,",
            f"{APPLE},1,,",
            f"{MSCI_WORLD},2,,,extra",
        ),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["dry_run"] is False
    assert [(row["line"], row["status"]) for row in body["rows"]] == [
        (2, "imported"),
        (3, "invalid"),
        (4, "invalid"),
        (5, "invalid"),
        (6, "not_found"),
        (7, "invalid"),
    ]
    assert body["rows"][0]["symbol"] == "MC.PA"
    assert body["rows"][0]["alternatives"] == ["MOH.DE", "LVMHF"]
    assert "check digit" in body["rows"][1]["message"]
    assert body["rows"][2]["message"].startswith("quantity:")
    assert body["rows"][3]["message"] == "The ISIN is already on line 2."
    position = await db_session.scalar(select(Position))
    assert position is not None
    assert position.instrument.yahoo_symbol == "MC.PA"
    assert (position.quantity, position.average_price) == (Decimal(10), Decimal("650.5"))
    assert await count(db_session, Position) == 1


async def test_import_rejects_a_file_with_an_unknown_column(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    openfigi: FakeOpenFigi,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.post(
        import_url(portfolio.id), files=csv_file("isin,quantity,broker", f"{LVMH},10,Degiro")
    )

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_file"
    assert "Unknown columns: broker." in response.json()["message"]
    assert openfigi.isins == []
    assert await count(db_session, Position) == 0


async def test_import_rejects_an_average_price_without_a_currency(
    auth_client: AsyncClient,
    make_portfolio: PortfolioFactory,
    openfigi: FakeOpenFigi,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.post(
        import_url(portfolio.id), files=csv_file("isin,average_price", f"{LVMH},650.5")
    )

    [row] = response.json()["rows"]
    assert row["status"] == "invalid"
    assert "currency is required when average_price is set" in row["message"]
    assert openfigi.isins == []


@pytest.mark.parametrize(
    ("isin", "currency", "expected"),
    [
        (LVMH, "", "MC.PA"),
        (MSCI_WORLD, "", "IWDA.AS"),
        (SP_500, "USD", "CSPX.L"),
        (SP_500, "GBP", "CSP1.L"),
    ],
)
async def test_import_picks_the_listing_by_exchange_and_currency(
    auth_client: AsyncClient,
    make_portfolio: PortfolioFactory,
    user: User,
    isin: str,
    currency: str,
    expected: str,
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.post(
        import_url(portfolio.id), files=csv_file("isin,currency", f"{isin},{currency}")
    )

    [row] = response.json()["rows"]
    assert (row["status"], row["symbol"]) == ("imported", expected)


async def test_import_reports_a_stored_instrument_in_another_currency(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    make_instrument: InstrumentFactory,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)
    await make_instrument("MC.PA", currency="EUR", isin=LVMH)

    response = await auth_client.post(
        import_url(portfolio.id), files=csv_file("isin,currency", f"{LVMH},JPY")
    )

    [row] = response.json()["rows"]
    assert (row["status"], row["symbol"]) == ("currency_mismatch", "MC.PA")
    assert row["message"] == "MC.PA trades in EUR, not JPY."
    assert await count(db_session, Position) == 0


async def test_import_dry_run_reports_without_writing(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)
    iwda = await make_instrument("IWDA.AS", currency="EUR", isin=MSCI_WORLD)
    await make_position(portfolio, iwda, quantity=Decimal(1))

    response = await auth_client.post(
        import_url(portfolio.id),
        params={"dry_run": "true"},
        files=csv_file("isin,quantity", f"{LVMH},10", f"{MSCI_WORLD},20"),
    )

    body = response.json()
    assert body["dry_run"] is True
    assert [(row["status"], row["symbol"]) for row in body["rows"]] == [
        ("imported", "MC.PA"),
        ("updated", "IWDA.AS"),
    ]
    assert await count(db_session, Instrument) == 1
    position = await db_session.scalar(select(Position))
    assert position is not None
    assert position.quantity == Decimal(1)


async def test_import_again_updates_the_columns_in_the_file(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    user: User,
) -> None:
    portfolio = await make_portfolio(user)
    await auth_client.post(
        import_url(portfolio.id),
        files=csv_file("isin,quantity,average_price,currency", f"{LVMH},10,650.5,EUR"),
    )

    response = await auth_client.post(
        import_url(portfolio.id), files=csv_file("isin,quantity", f"{LVMH},12")
    )

    [row] = response.json()["rows"]
    assert (row["status"], row["symbol"]) == ("updated", "MC.PA")
    position = await db_session.scalar(select(Position).execution_options(populate_existing=True))
    assert position is not None
    assert (position.quantity, position.average_price) == (Decimal(12), Decimal("650.5"))
    assert await count(db_session, Position) == 1


async def test_import_rejects_a_file_over_the_size_limit(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    portfolio = await make_portfolio(user)
    rows = [f"{LVMH}"] * (MAX_FILE_SIZE // len(LVMH))

    response = await auth_client.post(import_url(portfolio.id), files=csv_file("isin", *rows))

    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


async def test_import_into_another_users_portfolio_answers_404(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    other_user: User,
) -> None:
    portfolio = await make_portfolio(other_user)

    response = await auth_client.post(import_url(portfolio.id), files=csv_file("isin", LVMH))

    assert response.status_code == 404
    assert await count(db_session, Position) == 0


async def test_import_requires_authentication(
    client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    portfolio = await make_portfolio(user)

    response = await client.post(import_url(portfolio.id), files=csv_file("isin", LVMH))

    assert response.status_code == 401
