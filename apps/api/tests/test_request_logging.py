import uuid

import pytest
from fastapi import FastAPI
from httpx2 import AsyncClient
from structlog.contextvars import merge_contextvars
from structlog.testing import capture_logs

pytestmark = pytest.mark.anyio

URL = "/api/v1/health"


async def test_response_carries_a_generated_request_id(client: AsyncClient) -> None:
    response = await client.get(URL)

    assert uuid.UUID(response.headers["x-request-id"])


async def test_valid_incoming_request_id_is_reused(client: AsyncClient) -> None:
    response = await client.get(URL, headers={"X-Request-ID": "from-client-123"})

    assert response.headers["x-request-id"] == "from-client-123"


async def test_invalid_incoming_request_id_is_replaced(client: AsyncClient) -> None:
    response = await client.get(URL, headers={"X-Request-ID": "not valid\nlog line"})

    assert uuid.UUID(response.headers["x-request-id"])


async def test_each_request_is_logged_once_with_its_request_id(client: AsyncClient) -> None:
    with capture_logs(processors=[merge_contextvars]) as logs:
        response = await client.get(URL)

    request_logs = [dict(log) for log in logs if log["event"] == "http.request"]
    assert len(request_logs) == 1
    log = request_logs[0]
    assert isinstance(log.pop("duration_ms"), float)
    assert log == {
        "event": "http.request",
        "log_level": "info",
        "method": "GET",
        "path": URL,
        "status": 200,
        "request_id": response.headers["x-request-id"],
    }


async def test_unhandled_error_is_logged_and_returns_500_with_request_id(
    app: FastAPI, client: AsyncClient
) -> None:
    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    with capture_logs(processors=[merge_contextvars]) as logs:
        response = await client.get("/boom", headers={"X-Request-ID": "req-500"})

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "req-500"
    assert response.json() == {
        "code": "internal_error",
        "message": "An unexpected error occurred.",
        "details": None,
    }
    error_log = next(log for log in logs if log["event"] == "http.unhandled_error")
    assert error_log["request_id"] == "req-500"
    assert error_log["exc_info"] is True
