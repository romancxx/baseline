import pytest
from httpx2 import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.security import verify_password
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

URL = "/api/v1/auth/register"
PASSWORD = "correct horse battery staple"


def user_payload(**overrides: str) -> dict[str, str]:
    return {"email": "alice@example.com", "password": PASSWORD} | overrides


async def test_register_returns_201_with_the_lowercased_email(client: AsyncClient) -> None:
    response = await client.post(URL, json=user_payload(email="Alice.Smith@Example.COM"))

    assert response.status_code == 201
    assert response.json()["email"] == "alice.smith@example.com"


async def test_register_response_never_contains_the_password(client: AsyncClient) -> None:
    response = await client.post(URL, json=user_payload())

    assert set(response.json()) == {"id", "email", "created_at", "updated_at"}
    assert PASSWORD not in response.text


async def test_register_stores_an_argon2_hash_not_the_password(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await client.post(URL, json=user_payload())

    user = await db_session.scalar(select(User).where(User.email == "alice@example.com"))

    assert user is not None
    assert user.hashed_password != PASSWORD
    assert user.hashed_password.startswith("$argon2id$")
    assert verify_password(PASSWORD, user.hashed_password)


@pytest.mark.parametrize("email", ["alice@example.com", "ALICE@example.com"])
async def test_register_existing_email_returns_409(client: AsyncClient, email: str) -> None:
    await client.post(URL, json=user_payload())

    response = await client.post(URL, json=user_payload(email=email))

    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


async def test_register_rejects_a_short_password_without_echoing_it(
    client: AsyncClient,
) -> None:
    response = await client.post(URL, json=user_payload(password="tooshort1"))

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", "password"]
    assert "tooshort1" not in response.text


async def test_register_rejects_an_invalid_email(client: AsyncClient) -> None:
    response = await client.post(URL, json=user_payload(email="not-an-email"))

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", "email"]


async def test_register_never_logs_the_password(client: AsyncClient) -> None:
    with capture_logs() as logs:
        await client.post(URL, json=user_payload())
        await client.post(URL, json=user_payload())

    assert logs
    assert PASSWORD not in str(logs)
