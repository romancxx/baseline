from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

engine = create_async_engine(str(get_settings().database_url))
session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    """Provide one session per request.

    FastAPI runs this up to `yield` before the endpoint and injects the session. After the
    response it resumes past `yield`, and leaving `async with` closes the session.
    """
    async with session_factory() as session:
        yield session
