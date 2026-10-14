import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.database import get_db_session
from app.main import create_app


class FakeSession:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def execute(self, statement: object) -> None:
        if self.error is not None:
            raise self.error


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


def test_health_returns_ok_when_database_answers(app: FastAPI, client: TestClient) -> None:
    app.dependency_overrides[get_db_session] = lambda: FakeSession()

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_503_when_database_is_unreachable(app: FastAPI, client: TestClient) -> None:
    app.dependency_overrides[get_db_session] = lambda: FakeSession(ConnectionRefusedError())

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
