import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.modules.briefs.models import Tone
from app.modules.news.schemas import ArticleRead

DISCLAIMER = "Describes news as reported. Not investment advice."


class BriefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    tone: Tone
    model: str
    prompt_version: int
    # Publication times of the oldest and newest headline it was written from.
    period_start: dt.datetime
    period_end: dt.datetime
    generated_at: dt.datetime
    # The articles it cites, newest first.
    articles: list[ArticleRead]

    @computed_field
    @property
    def provenance(self) -> str:
        """e.g. "From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC"."""
        count = len(self.articles)
        noun = "article" if count == 1 else "articles"
        days = _days(self.period_start, self.period_end)
        generated = self.generated_at.astimezone(dt.UTC)
        return f"From {count} {noun}, {days}, generated {generated:%Y-%m-%d %H:%M} UTC"

    @computed_field
    @property
    def disclaimer(self) -> str:
        return DISCLAIMER


class BriefDraft(BaseModel):
    """The brief the model is asked to write, before the checks."""

    text: str = Field(
        description="1 to 5 sentences, at most 600 characters; empty when no headline bears on "
        "the company's business."
    )
    tone: Tone
    cited_article_ids: list[int] = Field(
        description="The numbers of the headlines the brief uses: at least one, or none when "
        "the text is empty."
    )


class BriefRunSummary(BaseModel):
    """What one brief generation did."""

    # How the model was reached: "api" or "cli".
    backend: str
    # Why the run did nothing, e.g. no backend set up.
    skipped: str | None = None
    # Followed security groups, and the briefs stored for those with new articles.
    groups: int = 0
    generated: int = 0
    # Groups with new articles, none of which bears on the business: no brief.
    no_news: int = 0
    # Briefs that needed the corrective retry, whether it passed or not.
    retried: int = 0
    # Why no brief was stored, by security name.
    failed: dict[str, str] = {}
    # Summed over every answer the model gave that reported them.
    input_tokens: int = 0
    output_tokens: int = 0


def _days(start: dt.datetime, end: dt.datetime) -> str:
    """The UTC days from `start` to `end`: "30 Oct", "28-30 Oct" or "30 Oct-2 Nov"."""
    first, last = start.astimezone(dt.UTC).date(), end.astimezone(dt.UTC).date()
    if first == last:
        return f"{last.day} {last:%b}"
    if (first.year, first.month) == (last.year, last.month):
        return f"{first.day}-{last.day} {last:%b}"
    return f"{first.day} {first:%b}-{last.day} {last:%b}"
