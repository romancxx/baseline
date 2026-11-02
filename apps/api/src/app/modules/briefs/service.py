import datetime as dt
import re
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

import structlog
from sqlalchemy import Row, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.client import AnthropicClient, InvalidOutputError
from app.modules.briefs.models import Brief, BriefArticle
from app.modules.briefs.schemas import BriefDraft, BriefRunSummary
from app.modules.news.models import Article, ArticleInstrument
from app.modules.news.schemas import SecurityGroup
from app.modules.news.service import followed_groups

logger = structlog.stdlib.get_logger(__name__)

# Stored with each brief; raise it whenever SYSTEM_PROMPT changes.
PROMPT_VERSION = 2
SYSTEM_PROMPT = """\
You write a short news brief about one listed company, from the headlines published about it \
in the last few days. You see only the headlines, numbered, never the articles.

Write 1 to 5 sentences, at most 600 characters, in English. One or two sentences are fine \
when there is little news. If no headline bears on the company's business, leave the text \
empty and cite nothing: no brief is better than filler.

Rules:
- Use only what the headlines say. Add no background, context or facts from your own \
knowledge, even well-known ones.
- Repeat dates, numbers and amounts exactly as the headline writes them. Never compute, \
convert or complete them: "this Monday" stays "this Monday", never a calendar date.
- Attribute each claim to the outlet that reported it ("Reuters reports...") or to the \
company when the headline quotes it.
- When outlets disagree, say so and name both: "Investing.com reports revenue topped \
estimates, while 24/7 Wall St. reports a miss."
- Ignore headlines that are not about this company, such as an arena, a person or a product \
of another company sharing its name. Do not cite them.
- Leave out items that do not bear on the business, such as its sports teams, sponsored \
events, or funds buying and selling its shares.
- Never comment on the headlines themselves: no "the headline gives no details", and never \
call an item routine.
- Never recommend, rate or predict in your own voice: no buy, sell or hold, no price \
direction or target, no advice, and never address the reader. An analyst's action is a \
reported fact: "Jefferies raised its rating to buy", "UBS raised its target to 700 euros".

Tone is how the reported facts bear on the company itself, not on its share price:
- positive or negative when the main story is good or bad for the company;
- mixed only when positive and negative facts both carry real weight; otherwise follow the \
main story;
- neutral when the news is routine or neither.

In cited_article_ids, give the numbers of the headlines the brief uses: at least one, or none \
when the text is empty."""

# Headlines sent per brief: the most recent ones, published within WINDOW.
MAX_HEADLINES = 40
WINDOW = dt.timedelta(days=3)
MIN_LENGTH = 40
MAX_LENGTH = 700
# Phrases that address the reader or advise, which attributed reporting does not use.
DENIED_PHRASES = (
    r"\byou(?:rs?|rself)?\b",
    r"\bshould (?:buy|sell|hold|add|avoid|consider)\b",
    r"\b(?:investors|shareholders|traders) should\b",
)
DENY_LIST = re.compile("|".join(DENIED_PHRASES), re.IGNORECASE)
# Attempts after the first, each told why the previous answer was rejected.
CORRECTIVE_RETRIES = 1
NO_KEY = "no API key"
NOT_STORED = "The brief could not be stored."


@dataclass
class _Attempts:
    """What the model's attempts at one brief cost, and why the last one failed."""

    reason: str = ""
    retried: bool = False
    input_tokens: int = 0
    output_tokens: int = 0


async def generate_briefs(session: AsyncSession, client: AnthropicClient) -> BriefRunSummary:
    """Write a brief for every followed security group with articles published after its latest
    brief's newest headline, from its recent headlines.

    A draft that fails the checks gets one corrective retry; one that fails again is logged and
    not stored. An empty draft, when no headline bears on the business, stores nothing. One
    group failing does not stop the others.
    """
    if not client.available:
        return _finish(BriefRunSummary(skipped=NO_KEY))

    since = dt.datetime.now(dt.UTC) - WINDOW
    groups = await followed_groups(session)
    todo = [
        (group, await _headlines(session, group, since))
        for group in groups
        if await _has_new_articles(session, group)
    ]
    await session.commit()

    summary = BriefRunSummary(groups=len(groups))
    for group, headlines in todo:
        if not headlines:
            continue
        try:
            draft, attempts = await _write(client, group.name, headlines)
        except ProviderUnavailableError as exc:
            summary.failed[group.name] = exc.message
            continue
        if attempts.retried:
            summary.retried += 1
        summary.input_tokens += attempts.input_tokens
        summary.output_tokens += attempts.output_tokens
        if draft is None:
            logger.warning("briefs.rejected", security=group.name, reason=attempts.reason)
            summary.failed[group.name] = f"Rejected twice: {attempts.reason}"
            continue
        if not draft.text.strip():
            summary.no_news += 1
            continue

        try:
            await _store(session, group, client.model, draft, attempts, headlines)
            await session.commit()
        except DBAPIError as exc:
            await session.rollback()
            logger.warning("briefs.store_failed", error=repr(exc.orig))
            summary.failed[group.name] = NOT_STORED
            continue
        summary.generated += 1

    return _finish(summary)


def headlines_message(name: str, headlines: Sequence[Row[uuid.UUID, str, str, dt.datetime]]) -> str:
    """The user message: the company's name, then its headlines numbered from 1, newest
    first."""
    lines = [f"Company: {name}", "", "Headlines, newest first:"]
    for number, (_, title, publisher, published_at) in enumerate(headlines, start=1):
        lines.append(f"[{number}] {published_at:%Y-%m-%d %H:%M} UTC | {publisher} | {title}")
    return "\n".join(lines)


def check_brief(draft: BriefDraft, headline_count: int) -> list[str]:
    """Why the draft cannot be stored, written to the model; empty when it passes."""
    # An empty text says no headline bears on the business.
    if not draft.text.strip():
        return []
    reasons: list[str] = []
    if not draft.cited_article_ids:
        reasons.append("It cites no headline: cite at least one number.")
    unknown = sorted({n for n in draft.cited_article_ids if not 1 <= n <= headline_count})
    if unknown:
        reasons.append(
            f"It cites numbers that are not in the list: {unknown}. Cite only numbers from 1 to "
            f"{headline_count}."
        )
    if not MIN_LENGTH <= len(draft.text) <= MAX_LENGTH:
        reasons.append(
            f"It is {len(draft.text)} characters long; write between {MIN_LENGTH} and {MAX_LENGTH}."
        )
    denied = dict.fromkeys(match.group().lower() for match in DENY_LIST.finditer(draft.text))
    if denied:
        phrases = ", ".join(f'"{phrase}"' for phrase in denied)
        reasons.append(
            f"It addresses the reader, advises or forecasts in its own voice ({phrases}). "
            "Report only what outlets wrote, attributed to them."
        )
    return reasons


async def _write(
    client: AnthropicClient,
    name: str,
    headlines: Sequence[Row[uuid.UUID, str, str, dt.datetime]],
) -> tuple[BriefDraft | None, _Attempts]:
    """Ask for a brief until a draft passes the checks, at most 1 + CORRECTIVE_RETRIES times;
    return the passing draft, or None."""
    attempts = _Attempts()
    first_message = headlines_message(name, headlines)
    message = first_message
    for attempt in range(1 + CORRECTIVE_RETRIES):
        attempts.retried = attempt > 0
        previous: str | None = None
        try:
            generation = await client.generate(SYSTEM_PROMPT, message, BriefDraft)
        except InvalidOutputError as exc:
            reasons = [exc.reason]
        else:
            attempts.input_tokens += generation.input_tokens
            attempts.output_tokens += generation.output_tokens
            previous = generation.output.text
            reasons = check_brief(generation.output, len(headlines))
            if not reasons:
                return generation.output, attempts
        attempts.reason = " ".join(reasons)
        logger.info(
            "briefs.draft_rejected",
            security=name,
            attempt=attempt + 1,
            reason=attempts.reason,
            draft=previous,
        )
        message = _corrective_message(first_message, previous, attempts.reason)
    return None, attempts


def _corrective_message(first_message: str, previous: str | None, reason: str) -> str:
    """The first message again, with the rejected brief and why it was rejected."""
    rejected = f"Your previous brief was rejected:\n{previous}\n" if previous else ""
    return (
        f"{first_message}\n\n{rejected}Why it was rejected: {reason}\n"
        "Write the brief again, fixing this and following every rule."
    )


async def _has_new_articles(session: AsyncSession, group: SecurityGroup) -> bool:
    """Whether one of the group's articles was published after the newest headline of its latest
    brief, or the group has articles and no brief."""
    latest_end = await session.scalar(
        select(Brief.period_end)
        .where(Brief.group_key == group.key)
        .order_by(Brief.generated_at.desc(), Brief.id.desc())
        .limit(1)
    )
    linked = select(ArticleInstrument.article_id).where(
        ArticleInstrument.instrument_id.in_(group.instrument_ids)
    )
    articles = select(Article).where(Article.id.in_(linked))
    if latest_end is not None:
        articles = articles.where(Article.published_at > latest_end)
    return bool(await session.scalar(select(articles.exists())))


async def _headlines(
    session: AsyncSession, group: SecurityGroup, since: dt.datetime
) -> Sequence[Row[uuid.UUID, str, str, dt.datetime]]:
    """The id, title, publisher and publication time of the group's MAX_HEADLINES most recent
    articles published since `since`, newest first."""
    linked = select(ArticleInstrument.article_id).where(
        ArticleInstrument.instrument_id.in_(group.instrument_ids)
    )
    statement = (
        select(Article.id, Article.title, Article.publisher, Article.published_at)
        .where(Article.id.in_(linked), Article.published_at >= since)
        .order_by(Article.published_at.desc(), Article.id.desc())
        .limit(MAX_HEADLINES)
    )
    return (await session.execute(statement)).all()


async def _store(
    session: AsyncSession,
    group: SecurityGroup,
    model: str,
    draft: BriefDraft,
    attempts: _Attempts,
    headlines: Sequence[Row[uuid.UUID, str, str, dt.datetime]],
) -> None:
    """Add the brief and its citations, mapping the cited numbers back to article ids."""
    published = [published_at for *_, published_at in headlines]
    brief = Brief(
        group_key=group.key,
        text=draft.text.strip(),
        tone=draft.tone,
        model=model,
        prompt_version=PROMPT_VERSION,
        input_tokens=attempts.input_tokens,
        output_tokens=attempts.output_tokens,
        period_start=min(published),
        period_end=max(published),
    )
    session.add(brief)
    # Inserts the brief, so its id is known.
    await session.flush()
    cited = dict.fromkeys(headlines[number - 1].id for number in draft.cited_article_ids)
    session.add_all(BriefArticle(brief_id=brief.id, article_id=article_id) for article_id in cited)


def _finish(summary: BriefRunSummary) -> BriefRunSummary:
    logger.info("briefs.run_finished", **summary.model_dump())
    return summary
