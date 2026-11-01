import re
import unicodedata
from typing import Protocol

from app.modules.news.schemas import FetchResult, NewsQuery


class NewsSource(Protocol):
    """Where articles come from. Any class with this `fetch` method is a NewsSource."""

    async def fetch(self, query: NewsQuery) -> FetchResult:
        """Return the source's articles for `query`, and what it dropped.

        Raises `ProviderUnavailableError` when the source cannot be reached or answers with
        something it cannot read.
        """
        ...


def title_key(title: str, publisher: str) -> str:
    """Reduce a title to a key that two copies of the same headline share.

    "Apple’s Q3 Beats Estimates - Reuters" from Reuters gives "apple s q3 beats estimates".
    """
    key = fold(title).removesuffix(f" - {fold(publisher)}")
    # Each run of punctuation, symbols and whitespace becomes one space.
    return re.sub(r"[\W_]+", " ", key).strip()


def fold(text: str) -> str:
    """Casefold `text` and remove its accents: "Société" gives "societe"."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))
