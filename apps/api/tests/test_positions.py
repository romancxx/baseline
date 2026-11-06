import uuid
from decimal import Decimal

import pytest
from conftest import InstrumentFactory, PositionFactory
from httpx2 import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.instruments.models import Instrument
from app.modules.portfolios.models import Portfolio
from app.modules.positions.models import Position

pytestmark = pytest.mark.anyio

URL = "/api/v1/portfolio/positions"


def position_payload(instrument_id: uuid.UUID, **overrides: object) -> dict[str, object]:
    return {"instrument_id": str(instrument_id), **overrides}


async def test_add_position_returns_it_with_its_instrument(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    portfolio: Portfolio,
) -> None:
    instrument = await make_instrument()

    response = await auth_client.post(
        URL, json=position_payload(instrument.id, quantity="10.5", average_price=182.25)
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "id",
        "instrument",
        "quantity",
        "average_price",
        "created_at",
        "updated_at",
    }
    assert body["instrument"]["yahoo_symbol"] == "AAPL"
    # Decimals are sent as strings, with the column's 8 decimal places.
    assert body["quantity"] == "10.50000000"
    assert body["average_price"] == "182.25000000"
    stored = await db_session.get(Position, uuid.UUID(body["id"]))
    assert stored is not None
    assert stored.portfolio_id == portfolio.id
    assert stored.quantity == Decimal("10.5")


async def test_add_position_without_quantity_or_price_leaves_them_null(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument()

    response = await auth_client.post(URL, json=position_payload(instrument.id))

    assert response.status_code == 201
    assert response.json()["quantity"] is None
    assert response.json()["average_price"] is None


async def test_add_position_of_an_instrument_already_held_returns_409(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    instrument = await make_instrument()
    await make_position(portfolio, instrument)

    response = await auth_client.post(URL, json=position_payload(instrument.id))

    assert response.status_code == 409
    assert response.json() == {
        "code": "conflict",
        "message": "This instrument is already in the portfolio.",
        "details": None,
    }


async def test_add_position_of_an_instrument_another_user_holds_succeeds(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
    other_portfolio: Portfolio,
) -> None:
    instrument = await make_instrument()
    await make_position(other_portfolio, instrument)

    response = await auth_client.post(URL, json=position_payload(instrument.id))

    assert response.status_code == 201


async def test_add_position_of_an_unknown_instrument_returns_404(
    auth_client: AsyncClient,
) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.post(URL, json=position_payload(instrument_id))

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument_id} not found."


@pytest.mark.parametrize("field", ["quantity", "average_price"])
@pytest.mark.parametrize("value", [-1, "0", "1.123456789", "12345678901", "NaN"])
async def test_add_position_rejects_a_value_that_is_not_positive_or_too_precise(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    field: str,
    value: object,
) -> None:
    instrument = await make_instrument()

    response = await auth_client.post(URL, json=position_payload(instrument.id, **{field: value}))

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", field]


async def test_list_positions_returns_mine_only_newest_first_page_by_page(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
    other_portfolio: Portfolio,
) -> None:
    for symbol in ["A", "B", "C"]:
        await make_position(portfolio, await make_instrument(symbol))
    await make_position(other_portfolio, await make_instrument("D"))

    pages: list[list[str]] = []
    params: dict[str, str | int] = {"limit": 2}
    while True:
        body = (await auth_client.get(URL, params=params)).json()
        pages.append([position["instrument"]["yahoo_symbol"] for position in body["items"]])
        if body["next_cursor"] is None:
            break
        params = {"limit": 2, "cursor": body["next_cursor"]}

    assert pages == [["C", "B"], ["A"]]


async def test_update_position_changes_only_the_fields_sent(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    position = await make_position(
        portfolio, await make_instrument(), quantity=Decimal(10), average_price=Decimal(100)
    )

    response = await auth_client.patch(f"{URL}/{position.id}", json={"quantity": "12"})

    assert response.status_code == 200
    assert Decimal(response.json()["quantity"]) == 12
    assert Decimal(response.json()["average_price"]) == 100
    assert response.json()["instrument"]["yahoo_symbol"] == "AAPL"


async def test_update_position_with_null_clears_the_field(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    position = await make_position(
        portfolio, await make_instrument(), quantity=Decimal(10), average_price=Decimal(100)
    )

    response = await auth_client.patch(f"{URL}/{position.id}", json={"quantity": None})

    assert response.status_code == 200
    assert response.json()["quantity"] is None
    assert Decimal(response.json()["average_price"]) == 100


@pytest.mark.parametrize("field", ["quantity", "average_price"])
async def test_update_position_rejects_a_negative_value(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
    field: str,
) -> None:
    position = await make_position(portfolio, await make_instrument())

    response = await auth_client.patch(f"{URL}/{position.id}", json={field: "-5"})

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", field]


async def test_remove_position_deletes_it(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    position = await make_position(portfolio, await make_instrument())

    response = await auth_client.delete(f"{URL}/{position.id}")

    assert response.status_code == 204
    assert await db_session.scalar(select(func.count()).select_from(Position)) == 0


@pytest.mark.parametrize(("method", "json"), [("PATCH", {"quantity": "1"}), ("DELETE", None)])
async def test_another_users_position_answers_404_and_is_left_untouched(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
    other_portfolio: Portfolio,
    method: str,
    json: dict[str, str] | None,
) -> None:
    position = await make_position(other_portfolio, await make_instrument(), quantity=Decimal(10))

    response = await auth_client.request(method, f"{URL}/{position.id}", json=json)

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": f"Position {position.id} not found.",
        "details": None,
    }
    await db_session.refresh(position)
    assert position.quantity == 10


async def test_deleting_a_portfolio_deletes_its_positions(
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    await make_position(portfolio, await make_instrument())

    await db_session.execute(delete(Portfolio).where(Portfolio.id == portfolio.id))

    assert await db_session.scalar(select(func.count()).select_from(Position)) == 0


async def test_an_instrument_held_in_a_portfolio_cannot_be_deleted(
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    instrument = await make_instrument()
    await make_position(portfolio, instrument)

    with pytest.raises(IntegrityError, match="fk_positions_instrument_id_instruments"):
        await db_session.execute(delete(Instrument).where(Instrument.id == instrument.id))


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", URL),
        ("GET", URL),
        ("PATCH", f"{URL}/{uuid.UUID(int=0)}"),
        ("DELETE", f"{URL}/{uuid.UUID(int=0)}"),
    ],
)
async def test_position_endpoints_require_a_token(
    client: AsyncClient, method: str, path: str
) -> None:
    response = await client.request(method, path)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
