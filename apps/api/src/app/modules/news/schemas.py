import uuid
from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    publisher: str
    published_at: datetime
    # As the source gives it, e.g. a news.google.com/rss/articles/… link.
    url: str


class NewsQuery(BaseModel):
    """Articles to fetch: about the security called `name`, published since `since`."""

    name: str
    since: AwareDatetime


class RawArticle(BaseModel):
    """An article as a news source returns it, before filtering and deduplication."""

    url: str
    title: str
    publisher: str
    published_at: AwareDatetime


class FetchResult(BaseModel):
    """What a news source returned for one query."""

    articles: list[RawArticle]
    # How many items the source dropped, by reason (e.g. "excluded_domain").
    dropped: dict[str, int]


class NewsIngestSummary(BaseModel):
    """What one news ingestion did."""

    # Followed stocks, and the queries sent for them: one per share class.
    instruments: int
    queries: int
    # Articles the source returned, and the items it dropped, by reason.
    fetched: int
    dropped: dict[str, int]
    # Articles stored for the first time, and links added between articles and instruments.
    new: int
    linked: int
    # Articles deleted for being older than the retention period.
    deleted: int
    # Why a group's articles were not stored, by its label: name and key.
    failed: dict[str, str]
