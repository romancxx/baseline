"""Bring the prices of every followed instrument up to date.

Run with `python -m app.jobs.update_prices` (`just update-prices`).
"""

import asyncio

from app.core.config import get_settings
from app.core.database import engine, session_factory
from app.core.logging import configure_logging
from app.integrations.yahoo.client import YahooClient
from app.modules.prices.service import update_prices


async def main() -> None:
    async with session_factory() as session:
        await update_prices(session, YahooClient())
    await engine.dispose()


if __name__ == "__main__":
    configure_logging(get_settings().environment)
    asyncio.run(main())
