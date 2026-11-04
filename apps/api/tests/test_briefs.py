import datetime as dt
import uuid

import pytest
from conftest import ArticleFactory, BriefFactory, InstrumentFactory
from httpx2 import AsyncClient

from app.modules.briefs.models import Tone
from app.modules.briefs.schemas import DISCLAIMER, BriefRead
from app.modules.news.models import Article
from app.modules.news.schemas import ArticleRead

pytestmark = pytest.mark.anyio

LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"
LVMH_FIGI = "BBG000BC7Q05"


def brief_url(instrument_id: uuid.UUID) -> str:
    return f"/api/v1/instruments/{instrument_id}/brief"


def utc(day: int, hour: int, month: int = 10) -> dt.datetime:
    return dt.datetime(2026, month, day, hour, tzinfo=dt.UTC)


def article_json(article: Article) -> dict[str, str]:
    return {
        "id": str(article.id),
        "title": article.title,
        "publisher": article.publisher,
        "published_at": article.published_at.isoformat().replace("+00:00", "Z"),
        "url": article.url,
    }


async def test_get_brief_returns_the_latest_with_its_citations_and_provenance(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
) -> None:
    apple = await make_instrument()
    beats = await make_article(apple, title="Apple beats estimates", published_at=utc(28, 9))
    record = await make_article(
        apple, title="Apple services hit a record", publisher="Bloomberg", published_at=utc(30, 5)
    )
    older = await make_article(apple, title="Apple prepares results", published_at=utc(27, 9))
    await make_brief(str(apple.id), older, generated_at=utc(28, 6))
    latest = await make_brief(str(apple.id), beats, record, generated_at=utc(30, 6))

    response = await auth_client.get(brief_url(apple.id))

    assert response.status_code == 200
    assert response.json() == {
        "id": str(latest.id),
        "text": latest.text,
        "tone": "positive",
        "model": "api:claude-haiku-5-5",
        "prompt_version": latest.prompt_version,
        "period_start": "2026-10-28T09:00:00Z",
        "period_end": "2026-10-30T05:00:00Z",
        "generated_at": "2026-10-30T06:00:00Z",
        "articles": [article_json(record), article_json(beats)],
        "provenance": "From 2 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC",
        "disclaimer": DISCLAIMER,
    }


async def test_get_brief_of_another_listing_returns_its_share_class_brief(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
) -> None:
    paris = await make_instrument("MC.PA", name=LVMH, share_class_figi=LVMH_FIGI)
    xetra = await make_instrument("MOH.DE", name=LVMH, share_class_figi=LVMH_FIGI)
    article = await make_article(paris, title="LVMH sales rise")
    brief = await make_brief(LVMH_FIGI, article)

    response = await auth_client.get(brief_url(xetra.id))

    assert response.status_code == 200
    assert response.json()["id"] == str(brief.id)


async def test_get_brief_of_an_instrument_without_one_answers_404(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
) -> None:
    apple = await make_instrument()
    microsoft = await make_instrument("MSFT", name="Microsoft Corporation")
    await make_brief(str(apple.id), await make_article(apple))

    response = await auth_client.get(brief_url(microsoft.id))

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert response.json()["message"] == f"Instrument {microsoft.id} has no brief yet."


async def test_get_brief_of_an_unknown_instrument_answers_404(auth_client: AsyncClient) -> None:
    instrument_id = uuid.uuid4()

    response = await auth_client.get(brief_url(instrument_id))

    assert response.status_code == 404
    assert response.json()["message"] == f"Instrument {instrument_id} not found."


async def test_get_brief_requires_a_token(client: AsyncClient) -> None:
    response = await client.get(brief_url(uuid.UUID(int=0)))

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


@pytest.mark.parametrize(
    ("start", "end", "cited", "expected"),
    [
        (utc(30, 1), utc(30, 5), 1, "From 1 article, 30 Oct, generated 2026-11-02 06:00 UTC"),
        (utc(28, 9), utc(30, 5), 7, "From 7 articles, 28-30 Oct, generated 2026-11-02 06:00 UTC"),
        (
            utc(30, 9),
            utc(2, 5, month=11),
            3,
            "From 3 articles, 30 Oct-2 Nov, generated 2026-11-02 06:00 UTC",
        ),
        (
            # 23:30 at UTC-4 is 03:30 the next day in UTC.
            dt.datetime(2026, 10, 29, 23, 30, tzinfo=dt.timezone(dt.timedelta(hours=-4))),
            utc(30, 5),
            2,
            "From 2 articles, 30 Oct, generated 2026-11-02 06:00 UTC",
        ),
    ],
    ids=["one day", "one month", "two months", "UTC days"],
)
def test_brief_provenance_gives_the_count_the_days_and_the_generation_time(
    start: dt.datetime, end: dt.datetime, cited: int, expected: str
) -> None:
    article = ArticleRead(
        id=uuid.uuid4(),
        title="Apple beats estimates",
        publisher="Reuters",
        published_at=end,
        url="https://news.google.com/rss/articles/1",
    )
    brief = BriefRead(
        id=uuid.uuid4(),
        text="Reuters reports Apple beat estimates.",
        tone=Tone.POSITIVE,
        model="api:claude-haiku-5-5",
        prompt_version=2,
        period_start=start,
        period_end=end,
        generated_at=utc(2, 6, month=11),
        articles=[article] * cited,
    )

    assert brief.provenance == expected
