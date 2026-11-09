import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx2 import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.config import get_settings
from app.core.security import JWT_ALGORITHM, verify_password
from app.modules.portfolios.models import Portfolio
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/users/me"
PASSWORD = "correct horse battery staple"


def user_payload(**overrides: str) -> dict[str, str]:
    return {"email": "alice@example.com", "password": PASSWORD} | overrides


async def test_register_returns_201_with_the_lowercased_email(client: AsyncClient) -> None:
    response = await client.post(REGISTER_URL, json=user_payload(email="Alice.Smith@Example.COM"))

    assert response.status_code == 201
    assert response.json()["email"] == "alice.smith@example.com"


async def test_register_response_never_contains_the_password(client: AsyncClient) -> None:
    response = await client.post(REGISTER_URL, json=user_payload())

    assert set(response.json()) == {"id", "email", "created_at", "updated_at"}
    assert PASSWORD not in response.text


async def test_register_stores_an_argon2_hash_not_the_password(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await client.post(REGISTER_URL, json=user_payload())

    user = await db_session.scalar(select(User).where(User.email == "alice@example.com"))

    assert user is not None
    assert user.hashed_password != PASSWORD
    assert user.hashed_password.startswith("$argon2id$")
    assert verify_password(PASSWORD, user.hashed_password)


async def test_register_creates_the_users_portfolio(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.post(REGISTER_URL, json=user_payload())

    portfolios = await db_session.scalars(
        select(Portfolio).where(Portfolio.user_id == uuid.UUID(response.json()["id"]))
    )
    assert [portfolio.name for portfolio in portfolios] == ["My portfolio"]


@pytest.mark.parametrize("email", ["alice@example.com", "ALICE@example.com"])
async def test_register_existing_email_returns_409(client: AsyncClient, email: str) -> None:
    await client.post(REGISTER_URL, json=user_payload())

    response = await client.post(REGISTER_URL, json=user_payload(email=email))

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


async def test_register_rejects_a_short_password_without_echoing_it(
    client: AsyncClient,
) -> None:
    response = await client.post(REGISTER_URL, json=user_payload(password="tooshort1"))

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", "password"]
    assert "tooshort1" not in response.text


async def test_register_rejects_an_invalid_email(client: AsyncClient) -> None:
    response = await client.post(REGISTER_URL, json=user_payload(email="not-an-email"))

    assert response.status_code == 422
    assert response.json()["details"][0]["loc"] == ["body", "email"]


async def test_register_never_logs_the_password(client: AsyncClient) -> None:
    with capture_logs() as logs:
        await client.post(REGISTER_URL, json=user_payload())
        await client.post(REGISTER_URL, json=user_payload())

    assert logs
    assert PASSWORD not in str(logs)


def token_for(subject: str, expires_in: timedelta, secret: str | None = None) -> str:
    now = datetime.now(UTC)
    key = secret or get_settings().jwt_secret.get_secret_value()
    payload = {"sub": subject, "iat": now, "exp": now + expires_in}
    return jwt.encode(payload, key, algorithm=JWT_ALGORITHM)  # pyright: ignore[reportUnknownMemberType]


async def test_login_returns_a_bearer_token_that_authenticates(client: AsyncClient) -> None:
    await client.post(REGISTER_URL, json=user_payload())

    response = await client.post(
        LOGIN_URL, data={"username": "Alice@Example.com", "password": PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 15 * 60
    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["email"] == "alice@example.com"


@pytest.mark.parametrize(
    ("username", "password"),
    [("alice@example.com", "wrong password 123"), ("nobody@example.com", PASSWORD)],
    ids=["wrong password", "unknown email"],
)
async def test_login_answers_bad_credentials_with_one_401(
    client: AsyncClient, username: str, password: str
) -> None:
    await client.post(REGISTER_URL, json=user_payload())

    response = await client.post(LOGIN_URL, data={"username": username, "password": password})

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {
        "code": "invalid_credentials",
        "message": "Incorrect email or password.",
        "details": None,
    }


async def test_me_returns_the_current_user(auth_client: AsyncClient, user: User) -> None:
    response = await auth_client.get(ME_URL)

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)


async def test_me_without_a_token_returns_401(client: AsyncClient) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["code"] == "unauthorized"


async def test_me_with_an_expired_token_returns_401(client: AsyncClient, user: User) -> None:
    token = token_for(str(user.id), expires_in=timedelta(seconds=-1))

    response = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


@pytest.mark.parametrize(
    "case", ["malformed", "wrong signature", "unknown user", "subject not a uuid"]
)
async def test_me_with_an_invalid_token_returns_401(
    client: AsyncClient, user: User, case: str
) -> None:
    token = {
        "malformed": "not.a.jwt",
        "wrong signature": token_for(str(user.id), timedelta(minutes=5), secret="x" * 40),
        "unknown user": token_for(str(uuid.uuid4()), timedelta(minutes=5)),
        "subject not a uuid": token_for("alice", timedelta(minutes=5)),
    }[case]

    response = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"
