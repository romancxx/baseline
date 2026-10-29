from decimal import Decimal

import pytest
from conftest import FakeOpenFigi, FakeYahoo, InstrumentFactory
from httpx2 import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.schemas import ListingDetails, QuoteType
from app.modules.instruments.models import Instrument

pytestmark = pytest.mark.anyio

URL = "/api/v1/instruments/resolve"
AZN_ISIN = "GB0009895292"
AZN_FIGI = "BBG001SCNW31"
AZN_DETAILS = ListingDetails(
    name="AstraZeneca PLC",
    exchange_code="LSE",
    currency="GBP",
    price_factor=Decimal("0.01"),
    quote_type=QuoteType.EQUITY,
)


async def stored_count(db_session: AsyncSession) -> int:
    return await db_session.scalar(select(func.count()).select_from(Instrument)) or 0


async def test_resolve_stores_a_new_listing_and_returns_201(
    auth_client: AsyncClient, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    yahoo.details["AZN.L"] = AZN_DETAILS
    openfigi.figis["AZN.L"] = AZN_FIGI

    response = await auth_client.post(URL, json={"yahoo_symbol": "azn.l", "isin": "gb0009895292"})

    assert response.status_code == 201
    body = response.json()
    assert {
        "type": "stock",
        "name": "AstraZeneca PLC",
        "yahoo_symbol": "AZN.L",
        "exchange_code": "LSE",
        "currency": "GBP",
        "isin": AZN_ISIN,
        "share_class_figi": AZN_FIGI,
    }.items() <= body.items()
    assert (await auth_client.get(f"/api/v1/instruments/{body['id']}")).json() == body


async def test_resolve_returns_a_stored_instrument_without_asking_the_providers(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
) -> None:
    stored = await make_instrument("AZN.L", name="AstraZeneca PLC", exchange_code="LSE")

    response = await auth_client.post(URL, json={"yahoo_symbol": "AZN.L"})

    assert response.status_code == 200
    assert response.json()["id"] == str(stored.id)
    assert yahoo.details_requested == []
    assert openfigi.symbols == []


async def test_resolve_of_a_symbol_yahoo_does_not_know_returns_404(
    auth_client: AsyncClient, db_session: AsyncSession, openfigi: FakeOpenFigi
) -> None:
    response = await auth_client.post(URL, json={"yahoo_symbol": "ZZZZNOTREAL"})

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": "Yahoo Finance has no stock or ETF ZZZZNOTREAL.",
        "details": None,
    }
    assert await stored_count(db_session) == 0
    assert openfigi.symbols == []


async def test_resolve_when_yahoo_is_down_returns_503(
    auth_client: AsyncClient, db_session: AsyncSession, yahoo: FakeYahoo
) -> None:
    yahoo.failure = ProviderUnavailableError("Yahoo Finance is unavailable. Try again later.")

    response = await auth_client.post(URL, json={"yahoo_symbol": "AZN.L"})

    assert response.status_code == 503
    assert response.json()["code"] == "provider_unavailable"
    assert await stored_count(db_session) == 0


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        (ProviderUnavailableError("OpenFIGI is unavailable. Try again later."), "unavailable"),
        (None, "no_match"),
    ],
    ids=["openfigi down", "no single match"],
)
async def test_resolve_stores_without_a_figi_when_openfigi_cannot_group_the_listing(
    auth_client: AsyncClient,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    failure: Exception | None,
    reason: str,
) -> None:
    yahoo.details["AZN.L"] = AZN_DETAILS
    openfigi.failure = failure

    with capture_logs() as logs:
        response = await auth_client.post(URL, json={"yahoo_symbol": "AZN.L"})

    assert response.status_code == 201
    assert response.json()["share_class_figi"] is None
    assert {
        "event": "instruments.figi_missing",
        "yahoo_symbol": "AZN.L",
        "reason": reason,
        "log_level": "warning",
    } in logs


async def test_resolve_returns_the_instrument_another_request_stored_meanwhile(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    yahoo: FakeYahoo,
) -> None:
    yahoo.details["AZN.L"] = AZN_DETAILS
    # Stored after this request checked the table and before it inserts.
    yahoo.while_fetching_details = lambda: make_instrument(
        "AZN.L", name="Stored meanwhile", exchange_code="LSE"
    )

    response = await auth_client.post(URL, json={"yahoo_symbol": "AZN.L"})

    assert response.status_code == 200
    assert response.json()["name"] == "Stored meanwhile"
    assert await stored_count(db_session) == 1


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"yahoo_symbol": ""}, "yahoo_symbol"),
        ({"yahoo_symbol": "AZN.L", "isin": "GB00"}, "isin"),
        ({"yahoo_symbol": "AZN.L", "isin": "GB0009895293"}, "isin"),
    ],
    ids=["empty symbol", "malformed isin", "wrong check digit"],
)
async def test_resolve_rejects_invalid_input(
    auth_client: AsyncClient, payload: dict[str, str], field: str
) -> None:
    response = await auth_client.post(URL, json=payload)

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", field]


async def test_resolve_requires_a_token(client: AsyncClient) -> None:
    response = await client.post(URL, json={"yahoo_symbol": "AZN.L"})

    assert response.status_code == 401
