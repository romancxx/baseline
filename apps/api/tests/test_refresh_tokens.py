from datetime import UTC, datetime, timedelta

import pytest
from httpx2 import AsyncClient, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.security import hash_refresh_token
from app.modules.auth.models import RefreshToken

pytestmark = pytest.mark.anyio

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/users/me"
EMAIL = "alice@example.com"
PASSWORD = "correct horse battery staple"


async def log_in(client: AsyncClient) -> Response:
    await client.post(REGISTER_URL, json={"email": EMAIL, "password": PASSWORD})
    return await client.post(LOGIN_URL, data={"username": EMAIL, "password": PASSWORD})


async def refresh_with(client: AsyncClient, token: str) -> Response:
    """Call /auth/refresh with exactly this token, ignoring the client's cookie jar."""
    client.cookies.clear()
    return await client.post(REFRESH_URL, headers={"Cookie": f"refresh_token={token}"})


async def test_login_sets_the_refresh_token_in_a_locked_down_cookie(client: AsyncClient) -> None:
    response = await log_in(client)

    cookie = response.headers["set-cookie"]
    assert cookie.startswith("refresh_token=")
    for attribute in ["HttpOnly", "Secure", "SameSite=strict", "Path=/api/v1/auth"]:
        assert attribute in cookie
    assert "Max-Age=2592000" in cookie
    assert response.cookies["refresh_token"] not in response.text


async def test_only_the_refresh_token_hash_is_stored(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = (await log_in(client)).cookies["refresh_token"]

    stored = (await db_session.scalars(select(RefreshToken.token_hash))).all()

    assert stored == [hash_refresh_token(token)]


async def test_refresh_rotates_the_refresh_token_and_returns_a_working_access_token(
    client: AsyncClient,
) -> None:
    first = (await log_in(client)).cookies["refresh_token"]

    response = await refresh_with(client, first)

    assert response.status_code == 200
    second = response.cookies["refresh_token"]
    assert second != first
    me = await client.get(
        ME_URL, headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me.json()["email"] == EMAIL


async def test_a_rotated_refresh_token_cannot_be_used_again(client: AsyncClient) -> None:
    first = (await log_in(client)).cookies["refresh_token"]
    await client.post(REFRESH_URL)

    response = await refresh_with(client, first)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_refresh_token"


async def test_reusing_a_rotated_token_revokes_every_token_of_the_user(
    client: AsyncClient,
) -> None:
    first = (await log_in(client)).cookies["refresh_token"]
    second = (await client.post(REFRESH_URL)).cookies["refresh_token"]

    with capture_logs() as logs:
        await refresh_with(client, first)

    assert (await refresh_with(client, second)).status_code == 401
    assert any(log["event"] == "auth.refresh_token_reused" for log in logs)


async def test_refresh_without_a_cookie_returns_401(client: AsyncClient) -> None:
    response = await client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["code"] == "invalid_refresh_token"


async def test_an_expired_refresh_token_is_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = (await log_in(client)).cookies["refresh_token"]
    await db_session.execute(
        update(RefreshToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )

    response = await refresh_with(client, token)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_refresh_token"


async def test_logout_revokes_the_refresh_token_and_clears_the_cookie(
    client: AsyncClient,
) -> None:
    token = (await log_in(client)).cookies["refresh_token"]

    response = await client.post(LOGOUT_URL)

    assert response.status_code == 204
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("refresh_token=")
    assert "Max-Age=0" in cookie
    assert (await refresh_with(client, token)).status_code == 401


async def test_logout_without_a_cookie_still_succeeds(client: AsyncClient) -> None:
    response = await client.post(LOGOUT_URL)

    assert response.status_code == 204
