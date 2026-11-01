"""Store the last day's news of every followed stock.

Run with `python -m app.jobs.ingest_news` (`just ingest-news`).
"""

import asyncio

from app.core.config import get_settings
from app.core.database import engine, session_factory
from app.core.logging import configure_logging
from app.integrations.google_news.client import GoogleNewsClient
from app.modules.news.service import ingest_news
from app.modules.news.sources import GoogleNewsSource


async def main() -> None:
    client = GoogleNewsClient()
    try:
        async with session_factory() as session:
            await ingest_news(session, GoogleNewsSource(client))
    finally:
        await client.aclose()
    await engine.dispose()


if __name__ == "__main__":
    configure_logging(get_settings().environment)
    asyncio.run(main())
