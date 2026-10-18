import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from httpx2 import AsyncClient, Response

pytestmark = pytest.mark.anyio

URL = "/api/v1/instruments"


def instrument_payload(**overrides: str) -> dict[str, str]:
    return {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "exchange": "XNAS",
        "currency": "USD",
        "type": "stock",
    } | overrides


async def create_instrument(client: AsyncClient, **overrides: str) -> dict[str, Any]:
    response = await client.post(URL, json=instrument_payload(**overrides))
    assert response.status_code == 201
    return response.json()


async def test_create_instrument_returns_it_with_generated_fields(client: AsyncClient) -> None:
    response = await client.post(URL, json=instrument_payload())

    assert response.status_code == 201
    body = response.json()
    assert instrument_payload().items() <= body.items()
    assert uuid.UUID(body["id"]).version == 7
    assert body["created_at"] is not None
    assert body["updated_at"] is not None


async def test_create_duplicate_symbol_and_exchange_returns_409(client: AsyncClient) -> None:
    await create_instrument(client)

    response = await client.post(URL, json=instrument_payload(name="Apple again"))

    assert response.status_code == 409
    assert response.json() == {
        "code": "conflict",
        "message": "An instrument with this symbol and exchange already exists.",
        "details": None,
    }


async def test_create_invalid_instrument_returns_422_with_one_detail_per_field(
    client: AsyncClient,
) -> None:
    response = await client.post(URL, json=instrument_payload(currency="USDD", type="bond"))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert [detail["loc"] for detail in body["details"]] == [["body", "currency"], ["body", "type"]]


async def test_get_instrument_returns_it(client: AsyncClient) -> None:
    created = await create_instrument(client)

    response = await client.get(f"{URL}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


async def test_get_unknown_instrument_returns_404(client: AsyncClient) -> None:
    instrument_id = uuid.uuid4()

    response = await client.get(f"{URL}/{instrument_id}")

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": f"Instrument {instrument_id} not found.",
        "details": None,
    }


def symbols(response: Response) -> list[str]:
    return [instrument["symbol"] for instrument in response.json()["items"]]


async def test_list_instruments_returns_newest_first_in_one_page(client: AsyncClient) -> None:
    await create_instrument(client, symbol="MSFT", name="Microsoft")
    await create_instrument(client, symbol="AAPL")

    response = await client.get(URL)

    assert response.status_code == 200
    assert symbols(response) == ["AAPL", "MSFT"]
    assert response.json()["next_cursor"] is None


async def test_list_instruments_follows_cursors_through_every_page(client: AsyncClient) -> None:
    for symbol in ["A", "B", "C", "D", "E"]:
        await create_instrument(client, symbol=symbol)

    pages: list[list[str]] = []
    params: dict[str, str | int] = {"limit": 2}
    while True:
        response = await client.get(URL, params=params)
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
    client: AsyncClient, limit: int
) -> None:
    response = await client.get(URL, params={"limit": limit})

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["query", "limit"]


async def test_list_instruments_rejects_invalid_cursor(client: AsyncClient) -> None:
    response = await client.get(URL, params={"cursor": "not-a-cursor"})

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
    client: AsyncClient, params: dict[str, str], expected: list[str]
) -> None:
    await create_instrument(client, symbol="AAPL")
    await create_instrument(client, symbol="AMZN", name="Amazon")
    await create_instrument(client, symbol="SPY", name="SPDR S&P 500", exchange="ARCX", type="etf")
    await create_instrument(client, symbol="AXB", name="AXB Corp")

    response = await client.get(URL, params=params)

    assert response.status_code == 200
    assert symbols(response) == expected


async def test_update_instrument_changes_only_given_fields(client: AsyncClient) -> None:
    created = await create_instrument(client)

    response = await client.patch(f"{URL}/{created['id']}", json={"name": "Apple"})

    assert response.status_code == 200
    body = response.json()
    assert body == created | {"name": "Apple", "updated_at": body["updated_at"]}


async def test_update_unknown_instrument_returns_404(client: AsyncClient) -> None:
    response = await client.patch(f"{URL}/{uuid.uuid4()}", json={"name": "Apple"})

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_update_to_existing_symbol_and_exchange_returns_409(client: AsyncClient) -> None:
    await create_instrument(client)
    microsoft = await create_instrument(client, symbol="MSFT", name="Microsoft")

    response = await client.patch(f"{URL}/{microsoft['id']}", json={"symbol": "AAPL"})

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


async def test_delete_instrument_removes_it(client: AsyncClient) -> None:
    created = await create_instrument(client)

    response = await client.delete(f"{URL}/{created['id']}")

    assert response.status_code == 204
    assert (await client.get(f"{URL}/{created['id']}")).status_code == 404


async def test_delete_unknown_instrument_returns_404(client: AsyncClient) -> None:
    response = await client.delete(f"{URL}/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
