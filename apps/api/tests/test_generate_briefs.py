import datetime as dt
import shutil
import uuid
from collections.abc import Sequence
from typing import Protocol

import pytest
from conftest import (
    ArticleFactory,
    FakeAnthropic,
    InstrumentFactory,
    PositionFactory,
)
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.config import LlmBackend, get_settings
from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.client import InvalidOutputError
from app.modules.briefs.models import Brief, BriefArticle, Tone
from app.modules.briefs.schemas import BriefDraft, BriefRunSummary
from app.modules.briefs.service import (
    NO_BACKEND,
    PROMPT_VERSION,
    LLMClient,
    check_brief,
    generate_briefs,
    llm_client,
)
from app.modules.instruments.models import Instrument
from app.modules.portfolios.models import Portfolio

pytestmark = pytest.mark.anyio

APPLE = "Apple Inc."
LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"
LVMH_FIGI = "BBG000BC7Q05"
BRIEF = (
    "Reuters reports Apple beat estimates on iPhone sales. Bloomberg says services revenue "
    "reached a record. The company said it would return more cash to shareholders."
)


def draft(text: str = BRIEF, cited: Sequence[int] = (1,)) -> BriefDraft:
    return BriefDraft(text=text, tone=Tone.POSITIVE, cited_article_ids=list(cited))


def hours_ago(hours: float) -> dt.datetime:
    return dt.datetime.now(dt.UTC) - dt.timedelta(hours=hours)


class Follow(Protocol):
    async def __call__(
        self, yahoo_symbol: str, name: str, *, share_class_figi: str | None = ...
    ) -> Instrument: ...


@pytest.fixture
async def follow(
    make_instrument: InstrumentFactory, make_position: PositionFactory, portfolio: Portfolio
) -> Follow:
    """A function that inserts a stock held in the portfolio of `user`."""

    async def make(
        yahoo_symbol: str, name: str, *, share_class_figi: str | None = None
    ) -> Instrument:
        instrument = await make_instrument(
            yahoo_symbol, name=name, share_class_figi=share_class_figi
        )
        await make_position(portfolio, instrument)
        return instrument

    return make


async def briefs(db_session: AsyncSession) -> list[Brief]:
    return list(await db_session.scalars(select(Brief).order_by(Brief.generated_at)))


async def citations(db_session: AsyncSession, brief: Brief) -> set[uuid.UUID]:
    rows = await db_session.scalars(
        select(BriefArticle.article_id).where(BriefArticle.brief_id == brief.id)
    )
    return set(rows)


async def test_generate_briefs_stores_a_brief_with_its_citations(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    beats = await make_article(apple, title="Apple beats estimates", published_at=hours_ago(5))
    record = await make_article(
        apple, title="Apple services hit a record", publisher="Bloomberg", published_at=hours_ago(2)
    )
    # Headline 2 is the older one; citing it twice stores one citation.
    anthropic.answers = [draft(cited=[2, 2])]
    # pyright checks here that FakeAnthropic has LLMClient's members.
    client: LLMClient = anthropic

    summary = await generate_briefs(db_session, client)

    assert summary == BriefRunSummary(
        backend="api", groups=1, generated=1, input_tokens=1000, output_tokens=100
    )
    [brief] = await briefs(db_session)
    assert (brief.group_key, brief.text, brief.tone) == (str(apple.id), BRIEF, Tone.POSITIVE)
    assert (brief.model, brief.prompt_version) == ("api:claude-haiku-5-5", PROMPT_VERSION)
    assert (brief.input_tokens, brief.output_tokens) == (1000, 100)
    assert (brief.period_start, brief.period_end) == (beats.published_at, record.published_at)
    assert await citations(db_session, brief) == {beats.id}


async def test_generate_briefs_sends_the_name_and_numbered_headlines_newest_first(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    published_at = dt.datetime.now(dt.UTC).replace(microsecond=0) - dt.timedelta(hours=2)
    await make_article(apple, title="Apple beats estimates", published_at=published_at)
    await make_article(apple, title="Apple services hit a record", publisher="Bloomberg")
    anthropic.answers = [draft()]

    await generate_briefs(db_session, anthropic)

    [message] = anthropic.messages
    lines = message.splitlines()
    assert lines[0] == f"Company: {APPLE}"
    assert lines[3].startswith("[1] ") and lines[3].endswith(
        " UTC | Bloomberg | Apple services hit a record"
    )
    assert lines[4] == f"[2] {published_at:%Y-%m-%d %H:%M} UTC | Reuters | Apple beats estimates"


async def test_generate_briefs_writes_one_brief_per_share_class(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    paris = await follow("MC.PA", LVMH, share_class_figi=LVMH_FIGI)
    frankfurt = await follow("MOH.DE", "LVMH SE", share_class_figi=LVMH_FIGI)
    await make_article(paris, frankfurt, title="LVMH sales slow")
    await make_article(frankfurt, title="LVMH names a new CFO")
    anthropic.answers = [draft()]

    await generate_briefs(db_session, anthropic)

    [message] = anthropic.messages
    assert message.startswith(f"Company: {LVMH}")
    assert "[2]" in message and "[3]" not in message
    [brief] = await briefs(db_session)
    assert brief.group_key == LVMH_FIGI


async def test_generate_briefs_sends_at_most_40_headlines_of_the_last_3_days(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple, title="Apple old news", published_at=hours_ago(73))
    for number in range(41):
        await make_article(apple, title=f"Apple headline {number}", published_at=hours_ago(1))
    anthropic.answers = [draft()]

    await generate_briefs(db_session, anthropic)

    [message] = anthropic.messages
    assert "[40]" in message and "[41]" not in message
    assert "Apple old news" not in message


async def test_generate_briefs_retries_an_invented_id_then_skips_the_group(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple)
    anthropic.answers = [draft(cited=[7]), draft(cited=[9])]

    with capture_logs() as logs:
        summary = await generate_briefs(db_session, anthropic)

    first, retry = anthropic.messages
    assert retry.startswith(first)
    assert f"Your previous brief was rejected:\n{BRIEF}" in retry
    assert "not in the list: [7]" in retry
    assert await briefs(db_session) == []
    assert summary.failed[APPLE].startswith("Rejected twice: It cites numbers")
    assert "[9]" in summary.failed[APPLE]
    assert (summary.retried, summary.input_tokens, summary.output_tokens) == (1, 2000, 200)
    assert [log["security"] for log in logs if log["event"] == "briefs.rejected"] == [APPLE]


async def test_generate_briefs_stores_the_brief_the_retry_fixed(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple)
    advice = BRIEF + " Investors should buy the shares now."
    anthropic.answers = [draft(text=advice), draft()]

    with capture_logs() as logs:
        summary = await generate_briefs(db_session, anthropic)

    assert '"investors should"' in anthropic.messages[1]
    [rejected] = [log for log in logs if log["event"] == "briefs.draft_rejected"]
    assert (rejected["security"], rejected["attempt"], rejected["draft"]) == (APPLE, 1, advice)
    [brief] = await briefs(db_session)
    assert brief.text == BRIEF
    assert (brief.input_tokens, brief.output_tokens) == (2000, 200)
    assert (summary.generated, summary.retried) == (1, 1)


async def test_generate_briefs_retries_an_answer_that_is_not_a_brief(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple)
    anthropic.answers = [InvalidOutputError("The answer stopped with max_tokens."), draft()]

    summary = await generate_briefs(db_session, anthropic)

    retry = anthropic.messages[1]
    assert "Why it was rejected: The answer stopped with max_tokens." in retry
    assert "Your previous brief" not in retry
    assert (summary.generated, summary.input_tokens) == (1, 1000)


@pytest.mark.parametrize(
    ("text", "cited", "reason"),
    [
        (BRIEF, [1], None),
        ("Reuters reports Apple raised its dividend.", [1], None),
        ("", [], None),
        ("Jefferies raised its rating to buy, Reuters reports. " + BRIEF, [1], None),
        ("Jefferies set a price target of $250, Reuters reports. " + BRIEF, [1], None),
        ("Apple said sales will rise, Reuters reports. " + BRIEF, [1], None),
        (BRIEF, [], "cites no headline"),
        (BRIEF, [0, 3], "not in the list: [0, 3]"),
        ("Apple beat estimates.", [1], "is 21 characters long"),
        (BRIEF * 5, [1], "characters long"),
        (BRIEF + " You may want to watch the results.", [1], '"you"'),
        (BRIEF + " Your shares look cheap.", [1], '"your"'),
        (BRIEF + " Investors should buy the dip.", [1], '"investors should"'),
        (BRIEF + " Readers should buy the dip.", [1], '"should buy"'),
    ],
    ids=[
        "valid",
        "one sentence",
        "no news",
        "attributed rating",
        "attributed price target",
        "reported forecast",
        "no citation",
        "unknown numbers",
        "too short",
        "too long",
        "second person",
        "possessive",
        "investors should",
        "should buy",
    ],
)
def test_check_brief_gives_the_reason_a_draft_fails(
    text: str, cited: list[int], reason: str | None
) -> None:
    reasons = check_brief(draft(text, cited), headline_count=2)

    if reason is None:
        assert reasons == []
    else:
        assert reason in " ".join(reasons)


async def test_generate_briefs_stores_nothing_when_no_headline_bears_on_the_business(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    toyota = await follow("7203.T", "Toyota Motor Corporation")
    await make_article(toyota, title="Toyota crowns 2026 TGR Cup champions")
    anthropic.answers = [draft(text="", cited=[])]

    summary = await generate_briefs(db_session, anthropic)

    assert await briefs(db_session) == []
    assert (summary.generated, summary.no_news, summary.retried) == (0, 1, 0)
    assert summary.failed == {}


async def test_generate_briefs_calls_the_model_only_for_new_articles(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple, published_at=hours_ago(2))
    anthropic.answers = [draft()]
    await generate_briefs(db_session, anthropic)

    unchanged = await generate_briefs(db_session, anthropic)
    # Published before the brief's newest headline, so not new.
    await make_article(apple, title="Apple opens a store", published_at=hours_ago(3))
    late = await generate_briefs(db_session, anthropic)
    await make_article(apple, title="Apple names a new CFO", published_at=hours_ago(1))
    anthropic.answers = [draft()]
    changed = await generate_briefs(db_session, anthropic)

    assert (unchanged.generated, late.generated, changed.generated) == (0, 0, 1)
    assert len(anthropic.messages) == 2
    assert len(await briefs(db_session)) == 2


async def test_generate_briefs_skips_a_group_whose_new_articles_are_too_old(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    apple = await follow("AAPL", APPLE)
    await make_article(apple, published_at=hours_ago(73))

    summary = await generate_briefs(db_session, anthropic)

    assert anthropic.messages == []
    assert summary == BriefRunSummary(backend="api", groups=1)


async def test_generate_briefs_reports_an_unavailable_api_and_goes_on(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    await make_article(await follow("AAPL", APPLE))
    await make_article(await follow("MC.PA", LVMH), title="LVMH sales slow")
    anthropic.answers = [ProviderUnavailableError("The Anthropic API is unavailable."), draft()]

    summary = await generate_briefs(db_session, anthropic)

    assert summary.failed == {APPLE: "The Anthropic API is unavailable."}
    assert summary.generated == 1


async def test_generate_briefs_stores_null_tokens_when_the_backend_does_not_count_them(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    await make_article(await follow("AAPL", APPLE))
    anthropic.token_counts = (None, None)
    anthropic.answers = [draft()]

    summary = await generate_briefs(db_session, anthropic)

    [brief] = await briefs(db_session)
    assert (brief.input_tokens, brief.output_tokens) == (None, None)
    assert (summary.input_tokens, summary.output_tokens) == (0, 0)


async def test_generate_briefs_without_a_backend_reports_it_and_does_nothing(
    db_session: AsyncSession,
    anthropic: FakeAnthropic,
    follow: Follow,
    make_article: ArticleFactory,
) -> None:
    await make_article(await follow("AAPL", APPLE))
    anthropic.has_key = False

    with capture_logs() as logs:
        summary = await generate_briefs(db_session, anthropic)

    assert summary == BriefRunSummary(backend="api", skipped=NO_BACKEND)
    assert anthropic.messages == []
    finished = [log for log in logs if log["event"] == "briefs.run_finished"]
    assert [(log["backend"], log["skipped"]) for log in finished] == [("api", NO_BACKEND)]


@pytest.mark.parametrize(
    ("backend", "api_key", "cli_installed", "chosen", "available"),
    [
        (LlmBackend.API, "sk-test", True, "api", True),
        (LlmBackend.API, None, True, "api", False),
        (LlmBackend.CLI, "sk-test", True, "cli", True),
        (LlmBackend.CLI, "sk-test", False, "cli", False),
    ],
    ids=[
        "api",
        "api without a key, cli installed",
        "cli despite a key",
        "cli not installed",
    ],
)
async def test_llm_client_follows_the_backend_setting(
    monkeypatch: pytest.MonkeyPatch,
    backend: LlmBackend,
    api_key: str | None,
    cli_installed: bool,
    chosen: str,
    available: bool,
) -> None:
    monkeypatch.setattr(shutil, "which", lambda name: f"/bin/{name}" if cli_installed else None)
    settings = get_settings().model_copy(
        update={
            "llm_backend": backend,
            "anthropic_api_key": SecretStr(api_key) if api_key else None,
        }
    )

    client = llm_client(settings)

    assert (client.backend, client.available) == (chosen, available)
    await client.aclose()
