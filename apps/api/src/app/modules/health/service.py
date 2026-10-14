from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.health.schemas import HealthStatus


async def check_database(session: AsyncSession) -> HealthStatus:
    try:
        await session.execute(text("SELECT 1"))
    # A refused connection raises OSError; driver and query errors raise SQLAlchemyError.
    except (OSError, SQLAlchemyError):
        return HealthStatus.UNAVAILABLE
    return HealthStatus.OK
