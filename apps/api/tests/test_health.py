import pytest
from fastapi import FastAPI
from httpx2 import AsyncClient

from app.core.database import get_db_session

pytestmark = pytest.mark.anyio

URL = "/api/v1/health"


class UnreachableSession:
    async def execute(self, statement: object) -> None:
        raise ConnectionRefusedError


async def test_health_returns_ok_when_database_answers(client: AsyncClient) -> None:
    response = await client.get(URL)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_returns_503_when_database_is_unreachable(
    app: FastAPI, client: AsyncClient
) -> None:
    app.dependency_overrides[get_db_session] = lambda: UnreachableSession()

    response = await client.get(URL)

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
