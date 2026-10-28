import uuid

import pytest
from conftest import PortfolioFactory
from httpx2 import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolios.models import Portfolio
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

URL = "/api/v1/portfolios"


async def test_create_portfolio_returns_it(
    auth_client: AsyncClient, db_session: AsyncSession, user: User
) -> None:
    response = await auth_client.post(URL, json={"name": "  Long term  "})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Long term"
    assert set(body) == {"id", "name", "created_at", "updated_at"}
    stored = await db_session.get(Portfolio, uuid.UUID(body["id"]))
    assert stored is not None
    assert stored.user_id == user.id


async def test_create_portfolio_with_a_name_already_used_returns_409(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    await make_portfolio(user, "Long term")

    response = await auth_client.post(URL, json={"name": "Long term"})

    assert response.status_code == 409
    assert response.json() == {
        "code": "conflict",
        "message": "You already have a portfolio with this name.",
        "details": None,
    }


async def test_create_portfolio_with_a_name_another_user_uses_succeeds(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, other_user: User
) -> None:
    await make_portfolio(other_user, "Long term")

    response = await auth_client.post(URL, json={"name": "Long term"})

    assert response.status_code == 201


@pytest.mark.parametrize("name", ["", "   ", "x" * 101])
async def test_create_portfolio_rejects_an_empty_or_long_name(
    auth_client: AsyncClient, name: str
) -> None:
    response = await auth_client.post(URL, json={"name": name})

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", "name"]


async def test_list_portfolios_returns_mine_only_newest_first_page_by_page(
    auth_client: AsyncClient,
    make_portfolio: PortfolioFactory,
    user: User,
    other_user: User,
) -> None:
    for name in ["A", "B", "C"]:
        await make_portfolio(user, name)
    await make_portfolio(other_user, "Not mine")

    pages: list[list[str]] = []
    params: dict[str, str | int] = {"limit": 2}
    while True:
        body = (await auth_client.get(URL, params=params)).json()
        pages.append([portfolio["name"] for portfolio in body["items"]])
        if body["next_cursor"] is None:
            break
        params = {"limit": 2, "cursor": body["next_cursor"]}

    assert pages == [["C", "B"], ["A"]]


async def test_get_portfolio_returns_it(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.get(f"{URL}/{portfolio.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(portfolio.id)


async def test_rename_portfolio_changes_its_name(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    portfolio = await make_portfolio(user, "Long term")

    response = await auth_client.patch(f"{URL}/{portfolio.id}", json={"name": "Retirement"})

    assert response.status_code == 200
    assert response.json()["name"] == "Retirement"


async def test_rename_portfolio_to_a_name_already_used_returns_409(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    await make_portfolio(user, "Long term")
    portfolio = await make_portfolio(user, "Trading")

    response = await auth_client.patch(f"{URL}/{portfolio.id}", json={"name": "Long term"})

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


async def test_delete_portfolio_removes_it(
    auth_client: AsyncClient, make_portfolio: PortfolioFactory, user: User
) -> None:
    portfolio = await make_portfolio(user)

    response = await auth_client.delete(f"{URL}/{portfolio.id}")

    assert response.status_code == 204
    assert (await auth_client.get(f"{URL}/{portfolio.id}")).status_code == 404


@pytest.mark.parametrize(
    ("method", "json"),
    [("GET", None), ("PATCH", {"name": "Taken over"}), ("DELETE", None)],
)
async def test_another_users_portfolio_answers_404_and_is_left_untouched(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    make_portfolio: PortfolioFactory,
    other_user: User,
    method: str,
    json: dict[str, str] | None,
) -> None:
    portfolio = await make_portfolio(other_user, "Not mine")

    response = await auth_client.request(method, f"{URL}/{portfolio.id}", json=json)

    assert response.status_code == 404
    assert response.json() == {
        "code": "not_found",
        "message": f"Portfolio {portfolio.id} not found.",
        "details": None,
    }
    await db_session.refresh(portfolio)
    assert portfolio.name == "Not mine"


async def test_unknown_portfolio_answers_404(auth_client: AsyncClient) -> None:
    response = await auth_client.get(f"{URL}/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_deleting_a_user_deletes_their_portfolios(
    db_session: AsyncSession, make_portfolio: PortfolioFactory, other_user: User
) -> None:
    await make_portfolio(other_user)

    await db_session.execute(delete(User).where(User.id == other_user.id))

    count = await db_session.scalar(select(func.count()).select_from(Portfolio))
    assert count == 0


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", URL),
        ("GET", URL),
        ("GET", f"{URL}/{uuid.UUID(int=0)}"),
        ("PATCH", f"{URL}/{uuid.UUID(int=0)}"),
        ("DELETE", f"{URL}/{uuid.UUID(int=0)}"),
    ],
)
async def test_portfolio_endpoints_require_a_token(
    client: AsyncClient, method: str, path: str
) -> None:
    response = await client.request(method, path)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
