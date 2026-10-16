import asyncio
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.database import get_db_session
from app.main import create_app

ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[str]:
    """Recreate the test database and migrate it to head; downgrade it to base at the end."""
    url = str(get_settings().database_url)
    name = make_url(url).database
    if name is None or not name.endswith("_test"):
        raise RuntimeError(f"Refusing to recreate {name!r}: test databases must end in '_test'.")

    asyncio.run(_recreate_database(url))
    config = Config(ALEMBIC_INI, attributes={"configure_logger": False})
    command.upgrade(config, "head")
    yield url
    command.downgrade(config, "base")


async def _recreate_database(url: str) -> None:
    test_url = make_url(url)
    # CREATE/DROP DATABASE cannot run inside a transaction, hence AUTOCOMMIT.
    engine = create_async_engine(test_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with engine.connect() as connection:
        name = connection.dialect.identifier_preparer.quote(test_url.database or "")
        await connection.execute(text(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)"))
        await connection.execute(text(f"CREATE DATABASE {name}"))
    await engine.dispose()


@pytest.fixture(scope="session")
async def engine(migrated_database: str) -> AsyncGenerator[AsyncEngine]:
    engine = create_async_engine(migrated_database, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession]:
    """A session inside a transaction that is rolled back after the test.

    The code under test commits and rolls back savepoints, never the outer transaction.
    """
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        yield session
        await session.close()
        await transaction.rollback()


@pytest.fixture
def app(db_session: AsyncSession) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: db_session
    return app


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
