from pydantic import BaseModel, Field

from app.modules.briefs.models import Tone


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

    # Why the run did nothing, e.g. "no API key".
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
    # Summed over every answer the model gave.
    input_tokens: int = 0
    output_tokens: int = 0
