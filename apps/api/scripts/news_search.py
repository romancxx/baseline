"""Search the real Google News for a security's last day of headlines, as ingestion would:
`just news-search "ASML Holding N.V."`."""

import asyncio
import datetime as dt
import sys

from app.core.exceptions import ProviderUnavailableError
from app.integrations.google_news.client import GoogleNewsClient
from app.modules.news.schemas import NewsQuery
from app.modules.news.sources import GoogleNewsSource, search_query


async def main(name: str) -> None:
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=1)
    client = GoogleNewsClient()
    try:
        result = await GoogleNewsSource(client).fetch(NewsQuery(name=name, since=since))
    finally:
        await client.aclose()

    print(f"Query: {search_query(name)}")
    for article in result.articles:
        print(f"{article.published_at:%Y-%m-%d %H:%M}  {article.publisher:24.24}  {article.title}")
    dropped = ", ".join(f"{reason} {count}" for reason, count in sorted(result.dropped.items()))
    print(f"{len(result.articles)} articles; dropped: {dropped or 'none'}")


if __name__ == "__main__":
    try:
        asyncio.run(main(" ".join(sys.argv[1:])))
    except ProviderUnavailableError as exc:
        sys.exit(exc.message)
