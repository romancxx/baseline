import datetime as dt
from collections.abc import AsyncGenerator
from pathlib import Path

import httpx2
import pytest

from app.integrations.google_news.client import GoogleNewsClient
from app.modules.news.schemas import NewsQuery, RawArticle
from app.modules.news.service import NewsSource
from app.modules.news.sources import GoogleNewsSource, news_name, search_query

pytestmark = pytest.mark.anyio

# A real Google News feed, recorded and trimmed: 3 articles and 4 junk items.
LVMH_FEED = (Path(__file__).parent / "fixtures" / "google_news" / "lvmh.xml").read_bytes()
LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"


@pytest.fixture
def requests() -> list[httpx2.Request]:
    """The requests `source` sent to Google News."""
    return []


@pytest.fixture
async def source(requests: list[httpx2.Request]) -> AsyncGenerator[GoogleNewsSource]:
    """A GoogleNewsSource whose client gets the LVMH feed for every request."""

    def handle(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        return httpx2.Response(200, content=LVMH_FEED)

    client = GoogleNewsClient(transport=httpx2.MockTransport(handle))
    yield GoogleNewsSource(client)
    await client.aclose()


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Apple Inc.", "Apple"),
        ("ASML Holding N.V.", "ASML Holding"),
        ("SAP SE", "SAP"),
        ("Nestlé S.A.", "Nestlé"),
        ("Shell plc", "Shell"),
        ("Siemens Aktiengesellschaft", "Siemens"),
        ("Novo Nordisk A/S", "Novo Nordisk"),
        ("Toyota Motor Corporation", "Toyota Motor"),
        (LVMH, "LVMH Moët Hennessy - Louis Vuitton"),
        ("Hermès International Société en commandite par actions", "Hermès International"),
        ("Banco Santander, S.A.", "Banco Santander"),
        ("Samsung Electronics Co., Ltd.", "Samsung Electronics"),
        ("JPMorgan Chase & Co.", "JPMorgan Chase"),
        (
            "Taiwan Semiconductor Manufacturing Company Limited",
            "Taiwan Semiconductor Manufacturing",
        ),
        ("AGCO Corporation", "AGCO"),
        ("Sanofi", "Sanofi"),
        ("SE", "SE"),
    ],
)
def test_news_name_strips_legal_forms(name: str, expected: str) -> None:
    assert news_name(name) == expected


def test_search_query_is_the_name_as_a_phrase_with_finance_terms_over_a_day() -> None:
    assert search_query("Apple Inc.") == (
        '"Apple" (shares OR stock OR earnings OR results OR revenue OR analyst OR investors)'
        " when:1d"
    )


async def test_google_news_source_searches_the_security(
    source: GoogleNewsSource, requests: list[httpx2.Request]
) -> None:
    await source.fetch(NewsQuery(name=LVMH, since=dt.datetime(2026, 10, 1, tzinfo=dt.UTC)))

    [request] = requests
    assert request.url.params["q"] == search_query(LVMH)


async def test_google_news_source_returns_the_articles_and_the_junk_counts(
    source: GoogleNewsSource,
) -> None:
    # pyright checks here that GoogleNewsSource has NewsSource's methods.
    news: NewsSource = source

    result = await news.fetch(NewsQuery(name=LVMH, since=dt.datetime(2026, 10, 1, tzinfo=dt.UTC)))

    assert [article.publisher for article in result.articles] == [
        "Le Monde.fr",
        "Idéal Investisseur",
        "BNN Bloomberg",
    ]
    assert result.articles[0] == RawArticle(
        url=result.articles[0].url,
        title="Hermès, the millions of missing shares and the questions over LVMH's role",
        publisher="Le Monde.fr",
        published_at=dt.datetime(2026, 10, 30, 6, 52, 14, tzinfo=dt.UTC),
    )
    assert result.articles[0].url.startswith("https://news.google.com/rss/articles/")
    assert result.dropped == {"excluded_domain": 1, "quote_page": 1, "chart_page": 2}


async def test_google_news_source_drops_articles_published_before_since(
    source: GoogleNewsSource,
) -> None:
    result = await source.fetch(
        NewsQuery(name=LVMH, since=dt.datetime(2026, 10, 30, tzinfo=dt.UTC))
    )

    assert [article.publisher for article in result.articles] == ["Le Monde.fr"]
    assert result.dropped["too_old"] == 2


@pytest.mark.parametrize(
    ("name", "publishers", "off_topic"),
    [
        ("Hermès International Société en commandite par actions", ["Le Monde.fr"], 2),
        ("HERMES INTERNATIONAL", ["Le Monde.fr"], 2),
        ("LVM SA", [], 3),
    ],
    ids=["first word", "other case and no accent", "part of a word"],
)
async def test_google_news_source_drops_articles_whose_title_does_not_name_the_security(
    source: GoogleNewsSource, name: str, publishers: list[str], off_topic: int
) -> None:
    result = await source.fetch(NewsQuery(name=name, since=dt.datetime(2026, 10, 1, tzinfo=dt.UTC)))

    assert [article.publisher for article in result.articles] == publishers
    assert result.dropped["off_topic"] == off_topic
