import datetime as dt
from typing import Protocol

import pytest
from conftest import (
    FakeNewsSource,
    InstrumentFactory,
    PortfolioFactory,
    PositionFactory,
    WatchlistItemFactory,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.modules.instruments.models import Instrument, InstrumentType
from app.modules.news.models import Article, ArticleInstrument
from app.modules.news.schemas import NewsIngestSummary, RawArticle
from app.modules.news.service import NOT_STORED, ingest_news
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"
LVMH_FIGI = "BBG000BC7Q05"
UNAVAILABLE = "Google News is unavailable. Try again later."


def article(
    token: str, title: str, *, hours_ago: float = 1, publisher: str = "Reuters"
) -> RawArticle:
    """An article as Google News links it, with `token` in its URL."""
    return RawArticle(
        url=f"https://news.google.com/rss/articles/{token}",
        title=title,
        publisher=publisher,
        published_at=dt.datetime.now(dt.UTC) - dt.timedelta(hours=hours_ago),
    )


class Follow(Protocol):
    async def __call__(
        self,
        yahoo_symbol: str,
        name: str,
        *,
        share_class_figi: str | None = ...,
        type: InstrumentType = ...,
    ) -> Instrument: ...


@pytest.fixture
async def follow(
    make_instrument: InstrumentFactory,
    make_portfolio: PortfolioFactory,
    make_position: PositionFactory,
    user: User,
) -> Follow:
    """A function that inserts an instrument held in a portfolio of `user`."""
    portfolio = await make_portfolio(user)

    async def make(
        yahoo_symbol: str,
        name: str,
        *,
        share_class_figi: str | None = None,
        type: InstrumentType = InstrumentType.STOCK,
    ) -> Instrument:
        instrument = await make_instrument(
            yahoo_symbol, name=name, share_class_figi=share_class_figi, type=type
        )
        await make_position(portfolio, instrument)
        return instrument

    return make


@pytest.fixture
def news() -> FakeNewsSource:
    return FakeNewsSource()


async def links(db_session: AsyncSession) -> set[tuple[str, str]]:
    """Each stored link, as the article's URL token and the instrument's Yahoo symbol."""
    rows = await db_session.execute(
        select(Article.url, Instrument.yahoo_symbol)
        .join(ArticleInstrument, ArticleInstrument.article_id == Article.id)
        .join(Instrument, Instrument.id == ArticleInstrument.instrument_id)
    )
    return {(url.rsplit("/", 1)[1], symbol) for url, symbol in rows}


async def stored_titles(db_session: AsyncSession) -> list[str]:
    return list(await db_session.scalars(select(Article.title).order_by(Article.published_at)))


async def test_ingest_news_queries_each_share_class_once_and_links_all_its_listings(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("MC.PA", LVMH, share_class_figi=LVMH_FIGI)
    await follow("MOH.DE", "LVMH Moet Hennessy Louis Vuitton SE", share_class_figi=LVMH_FIGI)
    await follow("AAPL", "Apple Inc.")
    await follow("MSFT", "Microsoft Corporation")
    news.articles[LVMH] = [article("lvmh", "LVMH shares rise")]
    news.articles["Apple Inc."] = [article("apple", "Apple shares rise")]

    summary = await ingest_news(db_session, news)

    assert [query.name for query in news.queries] == [LVMH, "Apple Inc.", "Microsoft Corporation"]
    assert await links(db_session) == {("lvmh", "MC.PA"), ("lvmh", "MOH.DE"), ("apple", "AAPL")}
    assert summary == NewsIngestSummary(
        instruments=4, queries=3, fetched=2, dropped={}, new=2, linked=3, deleted=0, failed={}
    )


async def test_ingest_news_asks_for_the_last_day(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    day_ago = dt.datetime.now(dt.UTC) - dt.timedelta(days=1)

    await ingest_news(db_session, news)

    [query] = news.queries
    assert day_ago <= query.since <= day_ago + dt.timedelta(minutes=1)


async def test_ingest_news_skips_etfs_and_instruments_nobody_follows(
    db_session: AsyncSession,
    news: FakeNewsSource,
    follow: Follow,
    make_instrument: InstrumentFactory,
    make_watchlist_item: WatchlistItemFactory,
    other_user: User,
) -> None:
    await follow("IWDA.AS", "iShares Core MSCI World UCITS ETF", type=InstrumentType.ETF)
    await make_instrument("MSFT", name="Microsoft Corporation")
    watched = await make_instrument("SAP.DE", name="SAP SE")
    await make_watchlist_item(other_user, watched)

    summary = await ingest_news(db_session, news)

    assert [query.name for query in news.queries] == ["SAP SE"]
    assert summary.instruments == 1


async def test_ingest_news_stores_an_article_found_for_two_groups_once(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("MC.PA", LVMH)
    await follow("RMS.PA", "Hermès International")
    both = article("both", "Hermès and LVMH shares fall")
    news.articles[LVMH] = [both]
    news.articles["Hermès International"] = [both]

    summary = await ingest_news(db_session, news)

    assert await stored_titles(db_session) == ["Hermès and LVMH shares fall"]
    assert await links(db_session) == {("both", "MC.PA"), ("both", "RMS.PA")}
    assert (summary.new, summary.linked) == (1, 2)


async def test_ingest_news_merges_a_title_published_again_within_3_days(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    news.articles["Apple Inc."] = [
        article("reuters", "Apple’s Q3 Beats Estimates", hours_ago=30),
        article("yahoo", "Apple's Q3 beats estimates - Yahoo Finance", publisher="Yahoo Finance"),
    ]

    summary = await ingest_news(db_session, news)

    assert await stored_titles(db_session) == ["Apple’s Q3 Beats Estimates"]
    assert await links(db_session) == {("reuters", "AAPL")}
    assert (summary.fetched, summary.new) == (2, 1)


async def test_ingest_news_keeps_a_title_published_again_after_3_days(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    news.articles["Apple Inc."] = [
        article("monday", "Apple shares rise", hours_ago=4 * 24),
        article("friday", "Apple shares rise"),
    ]

    summary = await ingest_news(db_session, news)

    assert await stored_titles(db_session) == ["Apple shares rise", "Apple shares rise"]
    assert summary.new == 2


async def test_ingest_news_links_an_article_stored_under_the_same_url_with_another_title(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    news.articles["Apple Inc."] = [article("abc", "Apple shares rise")]
    await ingest_news(db_session, news)
    await follow("MSFT", "Microsoft Corporation")
    news.articles["Microsoft Corporation"] = [article("abc", "Apple and Microsoft shares rise")]

    summary = await ingest_news(db_session, news)

    assert await stored_titles(db_session) == ["Apple shares rise"]
    assert await links(db_session) == {("abc", "AAPL"), ("abc", "MSFT")}
    assert (summary.new, summary.linked) == (0, 1)


async def test_ingest_news_run_again_changes_nothing(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("MC.PA", LVMH, share_class_figi=LVMH_FIGI)
    await follow("MOH.DE", "LVMH Moet Hennessy Louis Vuitton SE", share_class_figi=LVMH_FIGI)
    news.articles[LVMH] = [article("one", "LVMH shares rise"), article("two", "LVMH results")]
    await ingest_news(db_session, news)
    first_links = await links(db_session)

    summary = await ingest_news(db_session, news)

    assert await links(db_session) == first_links
    assert len(await stored_titles(db_session)) == 2
    assert summary == NewsIngestSummary(
        instruments=2, queries=1, fetched=2, dropped={}, new=0, linked=0, deleted=0, failed={}
    )


async def test_ingest_news_reports_a_failing_query_and_stores_the_others(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    await follow("MSFT", "Microsoft Corporation")
    news.unavailable = {"Apple Inc."}
    news.articles["Microsoft Corporation"] = [article("msft", "Microsoft shares rise")]

    summary = await ingest_news(db_session, news)

    assert summary.failed == {"Apple Inc.": UNAVAILABLE}
    assert await links(db_session) == {("msft", "MSFT")}


async def test_ingest_news_reports_a_group_whose_articles_cannot_be_stored(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    await follow("MSFT", "Microsoft Corporation")
    # PostgreSQL text cannot hold a NUL character.
    news.articles["Apple Inc."] = [article("ok", "Apple shares rise"), article("nul", "\x00")]
    news.articles["Microsoft Corporation"] = [article("msft", "Microsoft shares rise")]

    summary = await ingest_news(db_session, news)

    assert summary.failed == {"Apple Inc.": NOT_STORED}
    assert await links(db_session) == {("msft", "MSFT")}
    assert (summary.new, summary.linked) == (1, 1)


async def test_ingest_news_deletes_articles_older_than_30_days(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    news.articles["Apple Inc."] = [
        article("old", "Apple shares fall", hours_ago=31 * 24),
        article("new", "Apple shares rise"),
    ]

    summary = await ingest_news(db_session, news)

    assert await stored_titles(db_session) == ["Apple shares rise"]
    assert await links(db_session) == {("new", "AAPL")}
    assert summary.deleted == 1


async def test_ingest_news_logs_one_line_with_the_summary(
    db_session: AsyncSession, news: FakeNewsSource, follow: Follow
) -> None:
    await follow("AAPL", "Apple Inc.")
    news.articles["Apple Inc."] = [article("apple", "Apple shares rise")]
    news.dropped = {"excluded_domain": 2}

    with capture_logs() as logs:
        await ingest_news(db_session, news)

    finished = [log for log in logs if log["event"] == "news.ingest_finished"]
    assert finished == [
        {
            "event": "news.ingest_finished",
            "log_level": "info",
            "instruments": 1,
            "queries": 1,
            "fetched": 1,
            "dropped": {"excluded_domain": 2},
            "new": 1,
            "linked": 1,
            "deleted": 0,
            "failed": {},
        }
    ]
