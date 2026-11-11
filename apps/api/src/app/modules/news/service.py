import datetime as dt
import re
import unicodedata
import uuid
from collections import Counter
from collections.abc import Sequence
from typing import Protocol

import structlog
from sqlalchemy import Select, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ProviderUnavailableError
from app.core.pagination import KeysetPage, PageRequest, paginate
from app.modules.instruments.models import Instrument, InstrumentType
from app.modules.instruments.schemas import SecurityGroup
from app.modules.instruments.service import (
    followed_instrument_ids,
    get_instrument,
    group_by_share_class,
)
from app.modules.news.models import Article, ArticleInstrument, ArticleSource
from app.modules.news.schemas import FetchResult, NewsIngestSummary, NewsQuery, RawArticle

logger = structlog.stdlib.get_logger(__name__)

# How far back a run asks for articles.
LOOKBACK = dt.timedelta(days=1)
# An article whose title_key matches one published this close to it is the same article.
DUPLICATE_WINDOW = dt.timedelta(days=3)
# Articles published longer ago are deleted at the end of a run.
RETENTION = dt.timedelta(days=30)
NOT_STORED = "Its articles could not be stored."


class NewsSource(Protocol):
    """Where articles come from. Any class with this `source` and `fetch` is a NewsSource."""

    # Recorded on each article the source returns.
    source: ArticleSource

    async def fetch(self, query: NewsQuery) -> FetchResult:
        """Return the source's articles for `query`, and what it dropped.

        Raises `ProviderUnavailableError` when the source cannot be reached or answers with
        something it cannot read.
        """
        ...


async def ingest_news(session: AsyncSession, source: NewsSource) -> NewsIngestSummary:
    """Fetch the last day's articles of every stock held in a portfolio.

    Stocks are grouped by share class, with one query per group, and each article is linked to
    every stock of its group. One query failing does not stop the others. Articles older than
    RETENTION are deleted at the end.
    """
    now = dt.datetime.now(dt.UTC)
    groups = await followed_groups(session)
    await session.commit()

    fetched = new = linked = 0
    dropped: Counter[str] = Counter()
    failed: dict[str, str] = {}
    for group in groups:
        name, stock_ids = group.name, group.instrument_ids
        try:
            result = await source.fetch(NewsQuery(name=name, since=now - LOOKBACK))
        except ProviderUnavailableError as exc:
            failed[name] = exc.message
            continue
        fetched += len(result.articles)
        dropped.update(result.dropped)

        # One transaction per group: its articles and links are stored together or not at all.
        try:
            added, links = await _store(session, source.source, result.articles, stock_ids)
            await session.commit()
        except DBAPIError as exc:
            await session.rollback()
            logger.warning("news.store_failed", error=repr(exc.orig))
            failed[name] = NOT_STORED
            continue
        new += added
        linked += links

    deleted = await session.scalars(
        delete(Article).where(Article.published_at < now - RETENTION).returning(Article.id)
    )
    deleted_count = len(deleted.all())
    await session.commit()

    summary = NewsIngestSummary(
        instruments=sum(len(group.instrument_ids) for group in groups),
        queries=len(groups),
        fetched=fetched,
        dropped=dict(dropped),
        new=new,
        linked=linked,
        deleted=deleted_count,
        failed=failed,
    )
    logger.info("news.ingest_finished", **summary.model_dump())
    return summary


async def followed_groups(session: AsyncSession) -> list[SecurityGroup]:
    """The stocks held in a portfolio, grouped by share class, in the order they were stored."""
    stocks = await _followed_stocks(session)

    return [
        # The stocks come oldest first: the group's name is its first listing's.
        SecurityGroup(
            key=key, name=listings[0].name, instrument_ids=[stock.id for stock in listings]
        )
        for key, listings in group_by_share_class(stocks).items()
    ]


async def list_news(
    session: AsyncSession, instrument_id: uuid.UUID, page: PageRequest
) -> KeysetPage[Article]:
    """One page of the articles of the instrument's share class, newest published first."""
    instrument = await get_instrument(session, instrument_id)

    linked = select(ArticleInstrument.article_id).where(
        ArticleInstrument.instrument_id.in_(_listing_ids(instrument))
    )
    statement = select(Article).where(Article.id.in_(linked))
    return await paginate(session, statement, Article, page, order_by=Article.published_at)


def title_key(title: str, publisher: str) -> str:
    """Reduce a title to a key that two copies of the same headline share.

    "Apple’s Q3 Beats Estimates - Reuters" from Reuters gives "apple s q3 beats estimates".
    """
    key = fold(title).removesuffix(f" - {fold(publisher)}")
    # Each run of punctuation, symbols and whitespace becomes one space.
    return re.sub(r"[\W_]+", " ", key).strip()


def fold(text: str) -> str:
    """Casefold `text` and remove its accents: "Société" gives "societe"."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _listing_ids(instrument: Instrument) -> Select[uuid.UUID]:
    """The ids of the stored listings of the instrument's share class, as a subquery."""
    if instrument.share_class_figi is None:
        return select(Instrument.id).where(Instrument.id == instrument.id)
    return select(Instrument.id).where(Instrument.share_class_figi == instrument.share_class_figi)


async def _followed_stocks(session: AsyncSession) -> Sequence[Instrument]:
    """Every stock in a position, oldest first."""
    statement = (
        select(Instrument)
        .where(
            Instrument.id.in_(followed_instrument_ids()),
            Instrument.type == InstrumentType.STOCK,
        )
        .order_by(Instrument.created_at, Instrument.id)
    )
    return (await session.scalars(statement)).all()


async def _store(
    session: AsyncSession,
    source: ArticleSource,
    articles: Sequence[RawArticle],
    instrument_ids: Sequence[uuid.UUID],
) -> tuple[int, int]:
    """Store the articles not stored yet and link every article to every instrument; return
    how many articles and links were added."""
    article_ids: list[uuid.UUID] = []
    added = 0
    for article in articles:
        article_id, is_new = await _store_article(session, source, article)
        article_ids.append(article_id)
        if is_new:
            added += 1

    return added, await _link(session, article_ids, instrument_ids)


async def _store_article(
    session: AsyncSession, source: ArticleSource, article: RawArticle
) -> tuple[uuid.UUID, bool]:
    """The id of the article's stored copy, inserting it when there is none, and whether it was
    inserted."""
    key = title_key(article.title, article.publisher)
    window = Article.published_at.between(
        article.published_at - DUPLICATE_WINDOW, article.published_at + DUPLICATE_WINDOW
    )
    copy = await session.scalar(select(Article.id).where(Article.title_key == key, window).limit(1))
    if copy is not None:
        return copy, False

    statement = (
        insert(Article)
        .values(source=source, title_key=key, **article.model_dump())
        .on_conflict_do_nothing(index_elements=[Article.url])
        .returning(Article.id)
    )
    inserted = await session.scalar(statement)
    if inserted is not None:
        return inserted, True

    # Stored under the same URL with another title.
    stored = await session.scalars(select(Article.id).where(Article.url == article.url))
    return stored.one(), False


async def _link(
    session: AsyncSession, article_ids: Sequence[uuid.UUID], instrument_ids: Sequence[uuid.UUID]
) -> int:
    """Link every article to every instrument; return how many links were added."""
    links = [
        {"article_id": article_id, "instrument_id": instrument_id}
        for article_id in dict.fromkeys(article_ids)
        for instrument_id in instrument_ids
    ]
    if not links:
        return 0
    statement = (
        insert(ArticleInstrument)
        .values(links)
        .on_conflict_do_nothing()
        .returning(ArticleInstrument.article_id)
    )
    return len((await session.execute(statement)).all())
