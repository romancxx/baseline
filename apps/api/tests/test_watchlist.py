import uuid

import pytest
from conftest import InstrumentFactory, WatchlistItemFactory
from httpx2 import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.watchlist.models import WatchlistItem

pytestmark = pytest.mark.anyio

URL = "/api/v1/watchlist"


def item_payload(instrument_id: uuid.UUID) -> dict[str, object]:
    return {"instrument_id": str(instrument_id)}


async def watched_ids(db_session: AsyncSession, owner: User) -> set[uuid.UUID]:
    rows = await db_session.scalars(
        select(WatchlistItem.instrument_id).where(WatchlistItem.user_id == owner.id)
    )
    return set(rows)


async def test_add_to_watchlist_returns_201_with_the_instrument(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    user: User,
) -> None:
    instrument = await make_instrument()

    response = await auth_client.post(URL, json=item_payload(instrument.id))

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"instrument", "created_at"}
    assert body["instrument"]["yahoo_symbol"] == "AAPL"
    assert await watched_ids(db_session, user) == {instrument.id}


async def test_add_to_watchlist_an_instrument_already_there_returns_200_and_adds_nothing(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    user: User,
) -> None:
    instrument = await make_instrument()
    await make_watchlist_item(user, instrument)

    response = await auth_client.post(URL, json=item_payload(instrument.id))

    assert response.status_code == 200
    assert response.json()["instrument"]["id"] == str(instrument.id)
    count = await db_session.scalar(select(func.count()).select_from(WatchlistItem))
    assert count == 1


async def test_add_to_watchlist_an_unknown_instrument_returns_404(
    auth_client: AsyncClient,
) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.post(URL, json=item_payload(instrument_id))

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument_id} not found."


async def test_add_to_watchlist_an_instrument_another_user_watches_adds_it_for_me(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    user: User,
    other_user: User,
) -> None:
    instrument = await make_instrument()
    await make_watchlist_item(other_user, instrument)

    response = await auth_client.post(URL, json=item_payload(instrument.id))

    assert response.status_code == 201
    assert await watched_ids(db_session, user) == {instrument.id}


async def test_list_watchlist_returns_mine_only_newest_first(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    user: User,
    other_user: User,
) -> None:
    msft = await make_instrument("MSFT", name="Microsoft")
    aapl = await make_instrument("AAPL")
    nvda = await make_instrument("NVDA", name="NVIDIA")
    await make_watchlist_item(user, msft)
    await make_watchlist_item(user, aapl)
    await make_watchlist_item(other_user, nvda)

    response = await auth_client.get(URL)

    assert response.status_code == 200
    symbols = [item["instrument"]["yahoo_symbol"] for item in response.json()["items"]]
    assert symbols == ["AAPL", "MSFT"]


async def test_remove_from_watchlist_deletes_the_item(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    user: User,
) -> None:
    instrument = await make_instrument()
    await make_watchlist_item(user, instrument)

    response = await auth_client.delete(f"{URL}/{instrument.id}")

    assert response.status_code == 204
    assert await watched_ids(db_session, user) == set()


async def test_remove_from_watchlist_an_instrument_not_there_returns_404(
    auth_client: AsyncClient, make_instrument: InstrumentFactory
) -> None:
    instrument = await make_instrument()

    response = await auth_client.delete(f"{URL}/{instrument.id}")

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument.id} is not on your watchlist."


async def test_remove_from_watchlist_an_instrument_only_another_user_watches_returns_404(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    other_user: User,
) -> None:
    instrument = await make_instrument()
    await make_watchlist_item(other_user, instrument)

    response = await auth_client.delete(f"{URL}/{instrument.id}")

    assert response.status_code == 404
    assert await watched_ids(db_session, other_user) == {instrument.id}


@pytest.mark.parametrize(
    ("method", "path"),
    [("GET", URL), ("POST", URL), ("DELETE", f"{URL}/{uuid.uuid4()}")],
)
async def test_watchlist_requires_a_token(client: AsyncClient, method: str, path: str) -> None:
    response = await client.request(method, path)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
