from pydantic import AwareDatetime, BaseModel


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
