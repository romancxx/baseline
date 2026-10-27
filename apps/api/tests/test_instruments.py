import uuid

import pytest
from conftest import FakeYahoo, InstrumentFactory
from fastapi import FastAPI
from httpx2 import AsyncClient, Response
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.schemas import QuoteType, SearchResult
from app.modules.instruments.models import InstrumentType
from app.modules.instruments.schemas import InstrumentRead
from app.modules.instruments.service import MIN_LOCAL_RESULTS

pytestmark = pytest.mark.anyio

URL = "/api/v1/instruments"
LVMH_ISIN = "FR0000121014"
# Format-valid placeholder, not LVMH's real share class FIGI.
LVMH_FIGI = "BBG000LVMH00"


async def test_get_instrument_returns_it(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument()

    response = await auth_client.get(f"{URL}/{instrument.id}")

    assert response.status_code == 200
    assert response.json() == InstrumentRead.model_validate(instrument).model_dump(mode="json")


async def test_get_unknown_instrument_returns_404(auth_client: AsyncClient) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.get(f"{URL}/{instrument_id}")

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": f"Instrument {instrument_id} not found.",
        "details": None,
    }


def symbols(response: Response) -> list[str]:
    return [instrument["yahoo_symbol"] for instrument in response.json()["items"]]


async def test_list_instruments_returns_newest_first_in_one_page(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    await make_instrument("MSFT", name="Microsoft")
    await make_instrument("AAPL")

    response = await auth_client.get(URL)

    assert response.status_code == 200
    assert symbols(response) == ["AAPL", "MSFT"]
    assert response.json()["next_cursor"] is None


async def test_list_instruments_follows_cursors_through_every_page(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    for symbol in ["A", "B", "C", "D", "E"]:
        await make_instrument(symbol)

    pages: list[list[str]] = []
    params: dict[str, str | int] = {"limit": 2}
    while True:
        response = await auth_client.get(URL, params=params)
        pages.append(symbols(response))
        next_cursor = response.json()["next_cursor"]
        if next_cursor is None:
            break
        params = {"limit": 2, "cursor": next_cursor}

    assert pages == [["E", "D"], ["C", "B"], ["A"]]


async def test_list_instruments_documents_each_query_parameter(app: FastAPI) -> None:
    parameters = app.openapi()["paths"][URL]["get"]["parameters"]

    assert [(p["name"], p.get("required", False)) for p in parameters] == [
        ("type", False),
        ("exchange_code", False),
        ("symbol_prefix", False),
        ("share_class_figi", False),
        ("limit", False),
        ("cursor", False),
    ]


@pytest.mark.parametrize("limit", [0, 101])
async def test_list_instruments_rejects_limit_out_of_bounds(
    auth_client: AsyncClient, limit: int
) -> None:
    response = await auth_client.get(URL, params={"limit": limit})

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["query", "limit"]


async def test_list_instruments_rejects_invalid_cursor(auth_client: AsyncClient) -> None:
    response = await auth_client.get(URL, params={"cursor": "not-a-cursor"})

    assert response.status_code == 422
    assert response.json()["details"] == [
        {"loc": ["query", "cursor"], "message": "Invalid cursor.", "type": "value_error"}
    ]


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"type": "etf"}, ["SPY"]),
        ({"exchange_code": "pcx"}, ["SPY"]),
        ({"symbol_prefix": "am"}, ["AMZN"]),
        ({"symbol_prefix": "a", "type": "stock"}, ["AMZN", "AAPL"]),
        # "_" is matched literally, not as a LIKE wildcard.
        ({"symbol_prefix": "A_"}, []),
        ({"share_class_figi": LVMH_FIGI.lower()}, ["MOH.DE", "MC.PA"]),
    ],
)
async def test_list_instruments_applies_filters(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    params: dict[str, str],
    expected: list[str],
) -> None:
    await make_instrument("AAPL")
    await make_instrument("AMZN", name="Amazon")
    await make_instrument("SPY", type=InstrumentType.ETF, name="SPDR S&P 500", exchange_code="PCX")
    await make_instrument(
        "MC.PA", name="LVMH", exchange_code="PAR", currency="EUR", share_class_figi=LVMH_FIGI
    )
    await make_instrument(
        "MOH.DE", name="LVMH", exchange_code="GER", currency="EUR", share_class_figi=LVMH_FIGI
    )

    response = await auth_client.get(URL, params=params)

    assert response.status_code == 200
    assert symbols(response) == expected


async def test_instrument_yahoo_symbol_is_unique(make_instrument: InstrumentFactory) -> None:
    await make_instrument("MC.PA")

    with pytest.raises(IntegrityError, match="uq_instruments_yahoo_symbol"):
        await make_instrument("MC.PA")


async def test_instruments_can_share_an_isin(make_instrument: InstrumentFactory) -> None:
    paris = await make_instrument("MC.PA", isin=LVMH_ISIN)
    xetra = await make_instrument("MOH.DE", isin=LVMH_ISIN)

    assert paris.isin == xetra.isin == LVMH_ISIN


@pytest.mark.parametrize("isin", ["FR000012101", "fr0000121014", "FR000012101X"])
async def test_instrument_rejects_a_malformed_isin(
    make_instrument: InstrumentFactory, isin: str
) -> None:
    with pytest.raises(IntegrityError, match="ck_instruments_isin_format"):
        await make_instrument(isin=isin)


SEARCH_URL = f"{URL}/search"
LVMH_NAME = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"


async def add_catalog(make_instrument: InstrumentFactory) -> None:
    await make_instrument("AIR.PA", name="Airbus SE", exchange_code="PAR", currency="EUR")
    await make_instrument("AI.PA", name="Air Liquide SA", exchange_code="PAR", currency="EUR")
    await make_instrument("MSFT", name="Microsoft Corporation")
    await make_instrument("MC.PA", name=LVMH_NAME, exchange_code="PAR", isin=LVMH_ISIN)
    await make_instrument("MOH.DE", name=LVMH_NAME, exchange_code="GER", isin=LVMH_ISIN)
    await make_instrument("7203.T", name="Toyota Motor Corporation", exchange_code="JPX")


async def search(auth_client: AsyncClient, query: str) -> list[str]:
    response = await auth_client.get(SEARCH_URL, params={"q": query})
    assert response.status_code == 200
    return symbols(response)


async def test_search_ranks_symbol_prefixes_before_similar_names(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    await add_catalog(make_instrument)

    # Air Liquide's name matches "air" better than Airbus's, but AIR.PA starts with it.
    assert await search(auth_client, "air") == ["AIR.PA", "AI.PA"]


async def test_search_finds_every_listing_of_an_isin(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    await add_catalog(make_instrument)

    assert await search(auth_client, LVMH_ISIN.lower()) == ["MC.PA", "MOH.DE"]


@pytest.mark.parametrize("query", ["microsoft", "MICROSOFT", "msf", "MsF"])
async def test_search_ignores_case(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, query: str
) -> None:
    await add_catalog(make_instrument)

    assert await search(auth_client, query) == ["MSFT"]


@pytest.mark.parametrize(
    ("query", "expected"),
    [("louis vuiton", ["MC.PA", "MOH.DE"]), ("toyta motor", ["7203.T"])],
)
async def test_search_tolerates_typos(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    query: str,
    expected: list[str],
) -> None:
    await add_catalog(make_instrument)

    assert await search(auth_client, query) == expected


async def test_search_returns_at_most_20_instruments(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    for number in range(25):
        await make_instrument(f"FUND{number}", name=f"Fund {number}")

    assert len(await search(auth_client, "fund")) == 20


def yahoo_result(
    yahoo_symbol: str, exchange_code: str, quote_type: QuoteType = QuoteType.EQUITY
) -> SearchResult:
    return SearchResult(
        yahoo_symbol=yahoo_symbol,
        name="Airbus SE",
        exchange_code=exchange_code,
        quote_type=quote_type,
    )


async def test_search_appends_yahoo_candidates_when_few_instruments_match(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, yahoo: FakeYahoo
) -> None:
    await add_catalog(make_instrument)
    yahoo.results = [yahoo_result("AIR.DE", "GER"), yahoo_result("AIRB.L", "LSE", QuoteType.ETF)]

    response = await auth_client.get(SEARCH_URL, params={"q": "airbus"})

    assert response.status_code == 200
    body = response.json()
    assert [(item["source"], item["yahoo_symbol"]) for item in body["items"]] == [
        ("local", "AIR.PA"),
        ("yahoo", "AIR.DE"),
        ("yahoo", "AIRB.L"),
    ]
    assert body["items"][2] == {
        "source": "yahoo",
        "yahoo_symbol": "AIRB.L",
        "name": "Airbus SE",
        "exchange_code": "LSE",
        "type": "etf",
    }
    assert body["yahoo_unavailable"] is False
    assert yahoo.queries == ["airbus"]


async def test_search_drops_yahoo_results_already_stored(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, yahoo: FakeYahoo
) -> None:
    await add_catalog(make_instrument)
    # Stored, but under a name the query does not match.
    await make_instrument("EADSY", name="Unrelated Holdings")
    yahoo.results = [
        yahoo_result("AIR.PA", "PAR"),
        yahoo_result("EADSY", "PNK"),
        yahoo_result("AIR.DE", "GER"),
    ]

    response = await auth_client.get(SEARCH_URL, params={"q": "airbus"})

    assert [(item["source"], item["yahoo_symbol"]) for item in response.json()["items"]] == [
        ("local", "AIR.PA"),
        ("yahoo", "AIR.DE"),
    ]


async def test_search_does_not_ask_yahoo_when_enough_instruments_match(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, yahoo: FakeYahoo
) -> None:
    for number in range(MIN_LOCAL_RESULTS):
        await make_instrument(f"FUND{number}", name=f"Fund {number}")
    yahoo.results = [yahoo_result("AIR.DE", "GER")]

    response = await auth_client.get(SEARCH_URL, params={"q": "fund"})

    assert {item["source"] for item in response.json()["items"]} == {"local"}
    assert yahoo.queries == []


async def test_search_returns_local_results_when_yahoo_is_down(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, yahoo: FakeYahoo
) -> None:
    await add_catalog(make_instrument)
    yahoo.failure = ProviderUnavailableError("Yahoo Finance is unavailable. Try again later.")

    response = await auth_client.get(SEARCH_URL, params={"q": "airbus"})

    assert response.status_code == 200
    body = response.json()
    assert [item["yahoo_symbol"] for item in body["items"]] == ["AIR.PA"]
    assert body["yahoo_unavailable"] is True


async def test_search_documents_source_as_the_discriminator(app: FastAPI) -> None:
    schemas = app.openapi()["components"]["schemas"]
    items = schemas["InstrumentSearchResponse"]["properties"]["items"]["items"]

    assert items["discriminator"]["propertyName"] == "source"


@pytest.mark.parametrize("query", ["a", "  a  ", "x" * 101])
async def test_search_rejects_a_query_too_short_or_too_long(
    auth_client: AsyncClient, query: str
) -> None:
    response = await auth_client.get(SEARCH_URL, params={"q": query})

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["query", "q"]


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", URL),
        ("PATCH", f"{URL}/{uuid.UUID(int=0)}"),
        ("DELETE", f"{URL}/{uuid.UUID(int=0)}"),
    ],
)
async def test_instruments_cannot_be_written_through_the_api(
    auth_client: AsyncClient, method: str, path: str
) -> None:
    response = await auth_client.request(method, path)

    assert response.status_code == 405
    assert response.headers["allow"] == "GET"


@pytest.mark.parametrize("path", [URL, f"{URL}/{uuid.UUID(int=0)}", f"{SEARCH_URL}?q=apple"])
async def test_instruments_endpoints_require_a_token(client: AsyncClient, path: str) -> None:
    response = await client.get(path)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
