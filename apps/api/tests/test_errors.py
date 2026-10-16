import pytest
from httpx2 import AsyncClient

pytestmark = pytest.mark.anyio


async def test_unknown_route_returns_404_in_the_error_shape(client: AsyncClient) -> None:
    response = await client.get("/api/v1/nothing-here")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not Found", "details": None}


async def test_unsupported_method_returns_405_and_keeps_the_allow_header(
    client: AsyncClient,
) -> None:
    response = await client.delete("/api/v1/instruments")

    assert response.status_code == 405
    assert response.json()["code"] == "method_not_allowed"
    assert "allow" in response.headers
