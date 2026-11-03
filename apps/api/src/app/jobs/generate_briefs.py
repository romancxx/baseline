"""Write a brief for every followed security with new articles.

Run with `python -m app.jobs.generate_briefs` (`just brief`).
"""

import asyncio

from app.core.config import get_settings
from app.core.database import engine, session_factory
from app.core.logging import configure_logging
from app.modules.briefs.service import generate_briefs, llm_client


async def main() -> None:
    client = llm_client(get_settings())
    try:
        async with session_factory() as session:
            await generate_briefs(session, client)
    finally:
        await client.aclose()
    await engine.dispose()


if __name__ == "__main__":
    configure_logging(get_settings().environment)
    asyncio.run(main())
