from fastapi import APIRouter

from app.modules.health.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")
