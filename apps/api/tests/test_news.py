import datetime as dt
import uuid

import pytest
from conftest import ArticleFactory, FakeNewsSource, InstrumentFactory
from httpx2 import AsyncClient

from app.modules.news.schemas import NewsQuery, RawArticle
from app.modules.news.service import NewsSource, title_key

pytestmark = pytest.mark.anyio

LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"
LVMH_FIGI = "BBG000BC7Q05"


def news_url(instrument_id: uuid.UUID) -> str:
    return f"/api/v1/instruments/{instrument_id}/news"


def october(day: int) -> dt.datetime:
    return dt.datetime(2026, 10, day, 9, tzinfo=dt.UTC)


@pytest.mark.parametrize(
    ("title", "publisher", "expected"),
    [
        ("Apple beats estimates - Reuters", "Reuters", "apple beats estimates"),
        (
            "LVMH Moët Hennessy - Louis Vuitton shares rise - Reuters",
            "Reuters",
            "lvmh moet hennessy louis vuitton shares rise",
        ),
        ("Hermès lifts prices - LES ÉCHOS", "Les Echos", "hermes lifts prices"),
        ("SAP raises guidance - 24/7 Wall St.", "24/7 Wall St.", "sap raises guidance"),
        ("Apple beats estimates - Bloomberg", "Reuters", "apple beats estimates bloomberg"),
        ("Apple beats estimates", "Reuters", "apple beats estimates"),
    ],
    ids=[
        "suffix",
        "dash inside the title",
        "suffix in another case and accents",
        "suffix with punctuation",
        "another publisher's suffix",
        "no suffix",
    ],
)
def test_title_key_strips_the_publisher_suffix(title: str, publisher: str, expected: str) -> None:
    assert title_key(title, publisher) == expected


def test_title_key_folds_case_and_accents() -> None:
    key = title_key("SOCIÉTÉ GÉNÉRALE relève sa prévision", "Les Echos")

    assert key == "societe generale releve sa prevision"


def test_title_key_drops_punctuation_and_collapses_spaces() -> None:
    key = title_key("  Apple’s Q3:\trevenue up 5%,  beats “estimates”! ", "Reuters")

    assert key == "apple s q3 revenue up 5 beats estimates"


def test_title_key_is_the_same_for_copies_from_two_publishers() -> None:
    reuters = title_key("Apple’s results top estimates - Reuters", "Reuters")
    yahoo = title_key("Apple's results top estimates - Yahoo Finance", "Yahoo Finance")

    assert reuters == yahoo


async def test_fake_news_source_answers_with_its_articles() -> None:
    fake = FakeNewsSource()
    fake.articles["Apple"] = [
        RawArticle(
            url="https://news.google.com/rss/articles/abc",
            title="Apple beats estimates - Reuters",
            publisher="Reuters",
            published_at=dt.datetime(2026, 10, 30, 14, 0, tzinfo=dt.UTC),
        )
    ]
    fake.dropped = {"excluded_domain": 2}
    query = NewsQuery(name="Apple", since=dt.datetime(2026, 10, 30, tzinfo=dt.UTC))
    # pyright checks here that FakeNewsSource has NewsSource's attributes and methods.
    source: NewsSource = fake

    result = await source.fetch(query)

    assert result.articles == fake.articles["Apple"]
    assert result.dropped == {"excluded_domain": 2}
    assert fake.queries == [query]


async def test_list_news_returns_the_articles_newest_published_first(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, make_article: ArticleFactory
) -> None:
    apple = await make_instrument()
    microsoft = await make_instrument("MSFT", name="Microsoft Corporation")
    for day in [29, 31, 30]:
        await make_article(apple, title=f"Apple on {day} Oct", published_at=october(day))
    await make_article(microsoft, title="Microsoft on 30 Oct", published_at=october(30))

    response = await auth_client.get(news_url(apple.id))

    assert response.status_code == 200
    body = response.json()
    assert [item["title"] for item in body["items"]] == [
        "Apple on 31 Oct",
        "Apple on 30 Oct",
        "Apple on 29 Oct",
    ]
    assert set(body["items"][0]) == {"id", "title", "publisher", "published_at", "url"}
    assert body["next_cursor"] is None


async def test_list_news_follows_cursors_through_every_page(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, make_article: ArticleFactory
) -> None:
    apple = await make_instrument()
    # Stored out of publication order, with two published at the same time, which the id orders.
    days = [29, 27, 30, 29, 28]
    articles = [
        await make_article(apple, title=f"Apple {n}", published_at=october(day))
        for n, day in enumerate(days)
    ]
    expected = sorted(articles, key=lambda a: (a.published_at, a.id), reverse=True)

    titles: list[str] = []
    params: dict[str, str | int] = {"limit": 2}
    # Bounded, so a cursor that never advances fails the test instead of hanging it.
    for _ in days:
        body = (await auth_client.get(news_url(apple.id), params=params)).json()
        titles += [item["title"] for item in body["items"]]
        if body["next_cursor"] is None:
            break
        params = {"limit": 2, "cursor": body["next_cursor"]}

    assert titles == [article.title for article in expected]


async def test_list_news_of_another_listing_returns_its_share_class_news(
    auth_client: AsyncClient, make_instrument: InstrumentFactory, make_article: ArticleFactory
) -> None:
    paris = await make_instrument("MC.PA", name=LVMH, share_class_figi=LVMH_FIGI)
    # Not followed, so ingestion linked nothing to it.
    xetra = await make_instrument("MOH.DE", name=LVMH, share_class_figi=LVMH_FIGI)
    await make_article(paris, title="LVMH sales rise")
    await make_instrument("KER.PA", name="Kering SA", share_class_figi="BBG000BCB150")

    response = await auth_client.get(news_url(xetra.id))

    assert [item["title"] for item in response.json()["items"]] == ["LVMH sales rise"]


async def test_list_news_of_an_unknown_instrument_answers_404(auth_client: AsyncClient) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.get(news_url(instrument_id))

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument_id} not found."


async def test_list_news_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(news_url(uuid.UUID(int=0)))

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
