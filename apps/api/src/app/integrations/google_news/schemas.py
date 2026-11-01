from enum import StrEnum

from pydantic import AwareDatetime, BaseModel


class FeedItem(BaseModel):
    """An item of a Google News feed."""

    # A news.google.com/rss/articles/… link that redirects to the article.
    url: str
    # Without Google's " - Publisher" suffix.
    title: str
    publisher: str
    # From the item's <source url>, e.g. www.reuters.com.
    publisher_domain: str
    # In UTC.
    published_at: AwareDatetime


class JunkReason(StrEnum):
    EXCLUDED_DOMAIN = "excluded_domain"
    QUOTE_PAGE = "quote_page"
    CHART_PAGE = "chart_page"
    OPTION_PAGE = "option_page"
    DERIVATIVE_PAGE = "derivative_page"


class FilteredItems(BaseModel):
    """The items the junk filter kept, and how many it dropped for each reason."""

    kept: list[FeedItem]
    dropped: dict[JunkReason, int]
