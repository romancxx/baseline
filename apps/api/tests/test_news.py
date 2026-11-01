import datetime as dt

import pytest
from conftest import FakeNewsSource

from app.modules.news.schemas import NewsQuery, RawArticle
from app.modules.news.service import NewsSource, title_key

pytestmark = pytest.mark.anyio


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
