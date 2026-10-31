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
