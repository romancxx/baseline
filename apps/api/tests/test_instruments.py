import uuid

import pytest
from conftest import InstrumentFactory
from fastapi import FastAPI
from httpx2 import AsyncClient, Response

from app.modules.instruments.models import InstrumentType
from app.modules.instruments.schemas import InstrumentRead

pytestmark = pytest.mark.anyio

URL = "/api/v1/instruments"


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
    return [instrument["symbol"] for instrument in response.json()["items"]]


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
        ("exchange", False),
        ("symbol_prefix", False),
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
        ({"exchange": "arcx"}, ["SPY"]),
        ({"symbol_prefix": "am"}, ["AMZN"]),
        ({"symbol_prefix": "a", "type": "stock"}, ["AXB", "AMZN", "AAPL"]),
        # "_" is matched literally, not as a LIKE wildcard.
        ({"symbol_prefix": "A_"}, []),
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
    await make_instrument("SPY", name="SPDR S&P 500", exchange="ARCX", type=InstrumentType.ETF)
    await make_instrument("AXB", name="AXB Corp")

    response = await auth_client.get(URL, params=params)

    assert response.status_code == 200
    assert symbols(response) == expected


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


@pytest.mark.parametrize("path", [URL, f"{URL}/{uuid.UUID(int=0)}"])
async def test_instruments_endpoints_require_a_token(client: AsyncClient, path: str) -> None:
    response = await client.get(path)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
