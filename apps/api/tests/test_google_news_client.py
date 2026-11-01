import datetime as dt
from collections.abc import AsyncGenerator, Callable
from pathlib import Path

import httpx2
import pytest

from app.core.exceptions import ProviderUnavailableError
from app.integrations.google_news.client import GoogleNewsClient, drop_junk
from app.integrations.google_news.schemas import FeedItem, JunkReason

pytestmark = pytest.mark.anyio

# Real Google News feeds, recorded and trimmed.
FIXTURES = Path(__file__).parent / "fixtures" / "google_news"
LVMH_FEED = (FIXTURES / "lvmh.xml").read_bytes()
SAP_FEED = (FIXTURES / "sap.xml").read_bytes()

Handler = Callable[[httpx2.Request], httpx2.Response]
ClientFactory = Callable[[Handler], GoogleNewsClient]


@pytest.fixture
async def make_client() -> AsyncGenerator[ClientFactory]:
    """A function building a GoogleNewsClient that sends its requests to `handler`."""
    clients: list[GoogleNewsClient] = []

    def make(handler: Handler) -> GoogleNewsClient:
        client = GoogleNewsClient(transport=httpx2.MockTransport(handler))
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


def answer(content: bytes, status: int = 200) -> Handler:
    """A handler that answers every request with `content`."""
    return lambda request: httpx2.Response(status, content=content)


def feed(*items: str) -> bytes:
    """An RSS document holding `items`."""
    channel = f"<channel><title>Search</title>{''.join(items)}</channel>"
    return f"<rss version='2.0'>{channel}</rss>".encode()


def item(
    title: str | None = "Apple beats estimates - Reuters",
    pub_date: str | None = "Fri, 30 Oct 2026 06:52:14 GMT",
    source: str | None = "<source url='https://www.reuters.com'>Reuters</source>",
) -> str:
    """An RSS item shaped like Google's; None leaves that field out."""
    fields = [
        f"<title>{title}</title>" if title is not None else "",
        "<link>https://news.google.com/rss/articles/CBMi?oc=5</link>",
        f"<pubDate>{pub_date}</pubDate>" if pub_date is not None else "",
        source or "",
    ]
    return f"<item>{''.join(fields)}</item>"


def feed_item(title: str, domain: str = "www.reuters.com") -> FeedItem:
    return FeedItem(
        url="https://news.google.com/rss/articles/CBMi?oc=5",
        title=title,
        publisher="A publisher",
        publisher_domain=domain,
        published_at=dt.datetime(2026, 10, 30, tzinfo=dt.UTC),
    )


async def test_search_sends_the_query_in_english_from_the_us(make_client: ClientFactory) -> None:
    requests: list[httpx2.Request] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        return httpx2.Response(200, content=feed())

    await make_client(handler).search('"LVMH" when:1d')

    [request] = requests
    assert request.url.path == "/rss/search"
    assert dict(request.url.params) == {
        "q": '"LVMH" when:1d',
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }
    assert request.headers["user-agent"].startswith("StockNews/")


async def test_search_reads_titles_without_the_publisher_suffix(
    make_client: ClientFactory,
) -> None:
    items = await make_client(answer(LVMH_FEED)).search("LVMH")

    assert [(i.title, i.publisher, i.publisher_domain) for i in items] == [
        (
            "Hermès, the millions of missing shares and the questions over LVMH's role",
            "Le Monde.fr",
            "www.lemonde.fr",
        ),
        (
            "LVMH shares less than 1% above their 379.50 € support, lowest in 6 years",
            "Idéal Investisseur",
            "www.ideal-investisseur.fr",
        ),
        (
            "Darren Sissons' Past Picks: Danaher, LVMH Moët Hennessy & Shell Plc",
            "BNN Bloomberg",
            "www.bnnbloomberg.ca",
        ),
        (
            "LVMH's Buyback Filings Obscure the Real Test: Chinese Demand",
            "ad-hoc-news.de",
            "www.ad-hoc-news.de",
        ),
        (
            "LVMH Moët Hennessy - Louis Vuitton, Société Européenne (LVMUY) Stock Price, News,"
            " Quote & History",
            "Yahoo! Finance Canada",
            "ca.finance.yahoo.com",
        ),
        (
            "LVMH Moët Hennessy Louis Vuitton S.E. (LVMHF) Seasonal returns chart",
            "Yahoo Finance UK",
            "uk.finance.yahoo.com",
        ),
        (
            "CAC 40 (^FCHI) Charts, Data & News - Yahoo Finance",
            "Yahoo! Finance Canada",
            "ca.finance.yahoo.com",
        ),
    ]


async def test_search_keeps_the_google_link_and_reads_the_time_in_utc(
    make_client: ClientFactory,
) -> None:
    [google, offset] = await make_client(
        answer(feed(item(), item(pub_date="Fri, 30 Oct 2026 08:52:14 +0200")))
    ).search("Apple")

    assert google.url == "https://news.google.com/rss/articles/CBMi?oc=5"
    assert google.published_at == dt.datetime(2026, 10, 30, 6, 52, 14, tzinfo=dt.UTC)
    assert offset.published_at == google.published_at


async def test_search_skips_items_missing_a_field(make_client: ClientFactory) -> None:
    content = feed(
        item(title=None),
        item(pub_date=None),
        item(source=None),
        item(pub_date="not a date"),
        # A title that is only Google's suffix.
        item(
            title="- Boursorama",
            source="<source url='https://www.boursorama.com'>Boursorama</source>",
        ),
        item(title="Apple beats estimates - Reuters"),
    )

    items = await make_client(answer(content)).search("Apple")

    assert [i.title for i in items] == ["Apple beats estimates"]


async def test_search_keeps_the_items_before_a_truncated_end(make_client: ClientFactory) -> None:
    # Cut inside the third item's title.
    truncated = LVMH_FEED[: LVMH_FEED.index(b"Darren Sissons")]

    items = await make_client(answer(truncated)).search("LVMH")

    assert [i.publisher for i in items] == ["Le Monde.fr", "Idéal Investisseur"]


@pytest.mark.parametrize(
    "content",
    [
        b"<!doctype html><html><head><title>Sorry...</title></head>"
        b"<body>Our systems have detected unusual traffic.</body></html>",
        b"",
    ],
    ids=["html page", "empty body"],
)
async def test_search_raises_when_the_answer_is_not_a_feed(
    make_client: ClientFactory, content: bytes
) -> None:
    with pytest.raises(ProviderUnavailableError):
        await make_client(answer(content)).search("LVMH")


async def test_search_never_reads_the_answer_as_a_file_path(make_client: ClientFactory) -> None:
    path = str(FIXTURES / "lvmh.xml").encode()

    with pytest.raises(ProviderUnavailableError):
        await make_client(answer(path)).search("LVMH")


@pytest.mark.parametrize("status", [429, 503])
async def test_search_raises_on_an_error_status(make_client: ClientFactory, status: int) -> None:
    with pytest.raises(ProviderUnavailableError):
        await make_client(answer(LVMH_FEED, status)).search("LVMH")


async def test_search_raises_when_google_cannot_be_reached(make_client: ClientFactory) -> None:
    def refuse(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("Connection refused", request=request)

    with pytest.raises(ProviderUnavailableError):
        await make_client(refuse).search("LVMH")


@pytest.mark.parametrize(
    ("title", "domain", "reason"),
    [
        ("LVMH's Buyback Filings Obscure the Real Test", "www.ad-hoc-news.de", "excluded_domain"),
        ("Apple's October event in 12 minutes", "m.youtube.com", "excluded_domain"),
        ("Apple TV+ series renewed", "www.imdb.com", "excluded_domain"),
        (
            "Historical Data for SAP SE Tokenized Stock (Coinbase) in USD",
            "cryptorank.io",
            "excluded_domain",
        ),
        (
            "ASML Holding N.V. (ASML.AS) Stock Price, News, Quote & History",
            "ca.finance.yahoo.com",
            "quote_page",
        ),
        (
            "Toyota Motor Corporation (TMD.BA) stock price, news, quote and history",
            "uk.finance.yahoo.com",
            "quote_page",
        ),
        ("META_TITLE_QUOTE", "finance.yahoo.com", "quote_page"),
        ("Eurose C - Boursorama", "www.boursorama.com", "quote_page"),
        (
            "LVMH Moët Hennessy Louis Vuitton S.E. (LVMHF) Seasonal returns chart",
            "uk.finance.yahoo.com",
            "chart_page",
        ),
        (
            "CAC 40 (^FCHI) Charts, Data & News - Yahoo Finance",
            "ca.finance.yahoo.com",
            "chart_page",
        ),
        ("Apple Inc. (AAPL) Interactive Stock Chart", "finance.yahoo.com", "chart_page"),
        ("ASML Nov 2026 1060.000 put", "finance.yahoo.com", "option_page"),
        ("ASML261120P01060000", "finance.yahoo.com", "option_page"),
        (
            "SAP SE (Coinbase Tokenized Stock) (SAPC) Price Prediction for 2026 to 2031",
            "www.bybit.com",
            "derivative_page",
        ),
    ],
)
def test_drop_junk_drops_each_kind_of_page(title: str, domain: str, reason: str) -> None:
    filtered = drop_junk([feed_item(title, domain)])

    assert filtered.kept == []
    assert filtered.dropped == {reason: 1}


@pytest.mark.parametrize(
    ("title", "domain"),
    [
        ("ASML puts the Netherlands ahead in Europe's tech race, ING says", "ioplus.nl"),
        ("Is the Options Market Predicting a Spike in ASML Holding Stock?", "finance.yahoo.com"),
        (
            "Earnings call transcript: TotalEnergies tops Q3 2026 forecasts on strong cash flow",
            "au.investing.com",
        ),
        ("LVMH shares less than 1% above their 379.50 € support", "www.ideal-investisseur.fr"),
        ("SAP stock drops after ServiceNow, Fortinet results weigh", "notyoutube.com"),
    ],
)
def test_drop_junk_keeps_articles(title: str, domain: str) -> None:
    item = feed_item(title, domain)

    assert drop_junk([item]).kept == [item]


async def test_drop_junk_counts_what_it_drops_from_real_feeds(make_client: ClientFactory) -> None:
    lvmh = await make_client(answer(LVMH_FEED)).search("LVMH")
    sap = await make_client(answer(SAP_FEED)).search("SAP")

    filtered = drop_junk(lvmh + sap)

    assert [i.publisher for i in filtered.kept] == [
        "Le Monde.fr",
        "Idéal Investisseur",
        "BNN Bloomberg",
        "Yahoo Finance",
    ]
    assert filtered.dropped == {
        JunkReason.EXCLUDED_DOMAIN: 2,
        JunkReason.QUOTE_PAGE: 1,
        JunkReason.CHART_PAGE: 2,
        JunkReason.DERIVATIVE_PAGE: 1,
    }
