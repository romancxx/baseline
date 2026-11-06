import pytest
from httpx2 import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolios.models import Portfolio
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

URL = "/api/v1/portfolio"


async def test_get_portfolio_returns_the_current_users(
    auth_client: AsyncClient, portfolio: Portfolio, other_portfolio: Portfolio
) -> None:
    response = await auth_client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "name", "created_at", "updated_at"}
    assert body["id"] == str(portfolio.id)
    assert body["name"] == "My portfolio"


async def test_a_user_cannot_have_a_second_portfolio(
    db_session: AsyncSession, portfolio: Portfolio, user: User
) -> None:
    db_session.add(Portfolio(user_id=user.id, name="Trading"))

    with pytest.raises(IntegrityError, match="uq_portfolios_user_id"):
        await db_session.commit()


async def test_deleting_a_user_deletes_their_portfolio(
    db_session: AsyncSession, other_portfolio: Portfolio, other_user: User
) -> None:
    await db_session.execute(delete(User).where(User.id == other_user.id))

    count = await db_session.scalar(select(func.count()).select_from(Portfolio))
    assert count == 0


async def test_portfolio_endpoint_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(URL)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
