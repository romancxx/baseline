from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.health.schemas import HealthResponse, HealthStatus
from app.modules.health.service import check_database

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health(
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> HealthResponse:
    health_status = await check_database(session)
    if health_status is HealthStatus.UNAVAILABLE:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(status=health_status)
