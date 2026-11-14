import asyncio
import datetime as dt
import io
import re
from collections import Counter
from collections.abc import Iterable
from urllib.parse import urlsplit

# feedparser ships no type hints: what it returns is untyped.
import feedparser  # pyright: ignore[reportMissingTypeStubs]
import httpx2
import structlog
from aiolimiter import AsyncLimiter
from pydantic import BaseModel, Field, ValidationError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.google_news.schemas import FeedItem, FilteredItems, JunkReason

logger = structlog.stdlib.get_logger(__name__)

BASE_URL = "https://news.google.com"
SEARCH_PATH = "/rss/search"
LOCALE = {"hl": "en-US", "gl": "US", "ceid": "US:en"}
USER_AGENT = "Baseline/0.1 (personal news reader)"
TIMEOUT_SECONDS = 10
REQUEST_INTERVAL_SECONDS = 1

# Publishers whose items are dropped, with their subdomains.
EXCLUDED_DOMAINS = ("ad-hoc-news.de", "youtube.com", "imdb.com", "cryptorank.io")


def _phrases(*phrases: str) -> re.Pattern[str]:
    """A pattern that finds any of `phrases`, in any case."""
    return re.compile("|".join(re.escape(phrase) for phrase in phrases), re.IGNORECASE)


# Titles of pages that are not articles, checked in this order.
JUNK_TITLES: dict[JunkReason, re.Pattern[str]] = {
    JunkReason.QUOTE_PAGE: _phrases(
        "Stock Price, News, Quote",
        "META_TITLE_QUOTE",
        # Boursorama's quote pages are titled "<name> - Boursorama" before Google's suffix.
        " - Boursorama",
    ),
    JunkReason.CHART_PAGE: _phrases(
        "Seasonal Returns Chart", "Charts, Data & News", "Interactive Stock Chart"
    ),
    JunkReason.OPTION_PAGE: re.compile(
        # A contract ("Nov 2026 1060.000 put") or its symbol (ASML261120P01060000).
        r"\b[a-z]{3} \d{4} \d+\.\d+ (?:call|put)\b|\b[a-z]{1,6}\d{6}[cp]\d{8}\b",
        re.IGNORECASE,
    ),
    JunkReason.DERIVATIVE_PAGE: _phrases("Tokenized Stock"),
}


class _Source(BaseModel):
    href: str
    title: str


class _Entry(BaseModel):
    """The fields read from one feedparser entry."""

    title: str
    link: str
    # A time.struct_time, in UTC.
    published_parsed: tuple[int, ...] = Field(min_length=6)
    source: _Source


class _Feed(BaseModel):
    # "rss20", "atom10"…; missing or empty when the content is not a feed.
    version: str = ""
    entries: list[dict[str, object]] = []


class GoogleNewsClient:
    """Google News RSS search."""

    def __init__(self, transport: httpx2.AsyncBaseTransport | None = None) -> None:
        self._limiter = AsyncLimiter(1, time_period=REQUEST_INTERVAL_SECONDS)
        self._http = httpx2.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT_SECONDS,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def search(self, query: str) -> list[FeedItem]:
        """The items Google News finds for `query`; an item missing a field is skipped."""
        try:
            # Waits until REQUEST_INTERVAL_SECONDS have passed since the previous request.
            async with self._limiter:
                response = await self._http.get(SEARCH_PATH, params={"q": query, **LOCALE})
            response.raise_for_status()
        except httpx2.HTTPError as exc:
            logger.warning("google_news.request_failed", error=repr(exc))
            raise ProviderUnavailableError("Google News is unavailable. Try again later.") from exc

        feed = await asyncio.to_thread(_parse, response.content)
        if not feed.version:
            logger.warning("google_news.not_a_feed", query=query)
            raise ProviderUnavailableError("Google News is unavailable. Try again later.")

        items = [item for entry in feed.entries if (item := _feed_item(entry)) is not None]
        if len(items) < len(feed.entries):
            logger.warning(
                "google_news.items_skipped", query=query, skipped=len(feed.entries) - len(items)
            )
        return items


def drop_junk(items: Iterable[FeedItem]) -> FilteredItems:
    """Drop the items of excluded publishers and the pages that are not articles."""
    kept: list[FeedItem] = []
    dropped: Counter[JunkReason] = Counter()
    for item in items:
        reason = _junk_reason(item)
        if reason is None:
            kept.append(item)
        else:
            dropped[reason] += 1
    return FilteredItems(kept=kept, dropped=dict(dropped))


def _parse(content: bytes) -> _Feed:
    # A stream, so that feedparser never reads the content as a file path or a URL.
    return _Feed.model_validate(feedparser.parse(io.BytesIO(content)))  # pyright: ignore[reportUnknownMemberType]


def _feed_item(entry: dict[str, object]) -> FeedItem | None:
    """The entry as a FeedItem; None if it misses a field."""
    try:
        fields = _Entry.model_validate(entry)
    except ValidationError:
        return None

    title = fields.title.removesuffix(f"- {fields.source.title}").rstrip()
    domain = urlsplit(fields.source.href).hostname
    if not title or domain is None:
        return None

    return FeedItem(
        url=fields.link,
        title=title,
        publisher=fields.source.title,
        publisher_domain=domain,
        published_at=dt.datetime(*fields.published_parsed[:6], tzinfo=dt.UTC),
    )


def _junk_reason(item: FeedItem) -> JunkReason | None:
    domain = item.publisher_domain
    if any(domain == excluded or domain.endswith(f".{excluded}") for excluded in EXCLUDED_DOMAINS):
        return JunkReason.EXCLUDED_DOMAIN
    return next(
        (reason for reason, pattern in JUNK_TITLES.items() if pattern.search(item.title)), None
    )
