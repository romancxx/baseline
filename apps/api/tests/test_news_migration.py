import asyncio

from alembic import command
from alembic.config import Config
from conftest import ALEMBIC_INI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

# The revision that adds articles and article_instruments.
NEWS_REVISION = "9e071900c601"

NEWS_OBJECTS = text(
    "SELECT to_regclass('articles')::text, to_regclass('article_instruments')::text,"
    " to_regtype('article_source')::text"
)


def test_news_migration_downgrades_and_upgrades(migrated_database: str) -> None:
    config = Config(ALEMBIC_INI, attributes={"configure_logger": False})

    command.downgrade(config, f"{NEWS_REVISION}-1")
    assert asyncio.run(_news_objects(migrated_database)) == (None, None, None)

    command.upgrade(config, "head")
    assert asyncio.run(_news_objects(migrated_database)) == (
        "articles",
        "article_instruments",
        "article_source",
    )


async def _news_objects(url: str) -> tuple[str | None, ...]:
    """The names of the news tables and enum type, or None for each one missing."""
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.connect() as connection:
        row = (await connection.execute(NEWS_OBJECTS)).one()
    await engine.dispose()
    return tuple(row)
