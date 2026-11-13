import re

from app.integrations.google_news.client import GoogleNewsClient, drop_junk
from app.integrations.google_news.schemas import FeedItem
from app.modules.news.models import ArticleSource
from app.modules.news.schemas import FetchResult, NewsQuery, RawArticle
from app.modules.news.service import LOOKBACK, fold

# Legal forms that end company names, matched in any case.
LEGAL_FORMS = (
    "Inc.",
    "Inc",
    "Incorporated",
    "Corporation",
    "Corp.",
    "Corp",
    "Company",
    "Co.",
    "Limited",
    "Ltd.",
    "Ltd",
    "plc",
    "p.l.c.",
    "SE",
    "S.E.",
    "SA",
    "S.A.",
    "AG",
    "Aktiengesellschaft",
    "N.V.",
    "NV",
    "A/S",
    "ASA",
    "AB",
    "S.p.A.",
    "SpA",
    "GmbH",
    "KGaA",
    "SCA",
    "S.C.A.",
    "Société Européenne",
    "Société anonyme",
    "Société en commandite par actions",
)
# A legal form at the end of a name, with the spaces or comma before it.
LEGAL_FORM_SUFFIX = re.compile(
    r"[\s,]+(?:" + "|".join(re.escape(form) for form in LEGAL_FORMS) + r")$", re.IGNORECASE
)
# Left after a legal form is removed. A trailing "." stays: it ends an abbreviation ("Co.").
TRAILING_PUNCTUATION = " ,;:&-"

# Words that keep a query to finance news, from the probes in ADR 0010.
FINANCE_TERMS = ("shares", "stock", "earnings", "results", "revenue", "analyst", "investors")
# Google's search operator for the last LOOKBACK days.
WHEN = f"when:{LOOKBACK.days}d"

# The reasons given for items whose title does not name the security, and for items
# published before the query's `since`.
OFF_TOPIC = "off_topic"
TOO_OLD = "too_old"


def news_name(name: str) -> str:
    """The name without its legal forms: "Samsung Electronics Co., Ltd." gives "Samsung
    Electronics". A name that is only a legal form is returned as it is."""
    name = name.strip()
    while True:
        stripped = LEGAL_FORM_SUFFIX.sub("", name).rstrip(TRAILING_PUNCTUATION)
        if stripped == name or not stripped:
            return name
        name = stripped


def search_query(name: str) -> str:
    """The Google News query for a security: its name as an exact phrase, finance terms and
    the lookback, e.g. '"Apple" (shares OR stock OR …) when:1d'."""
    return f'"{news_name(name)}" ({" OR ".join(FINANCE_TERMS)}) {WHEN}'


class GoogleNewsSource:
    """The NewsSource over Google News RSS search."""

    source = ArticleSource.GOOGLE_NEWS

    def __init__(self, client: GoogleNewsClient) -> None:
        self._client = client

    async def fetch(self, query: NewsQuery) -> FetchResult:
        items = await self._client.search(search_query(query.name))
        filtered = drop_junk(items)
        dropped = {reason.value: count for reason, count in filtered.dropped.items()}

        mention = _mention(query.name)
        on_topic = [item for item in filtered.kept if mention.search(fold(item.title))]
        recent = [item for item in on_topic if item.published_at >= query.since]
        if len(on_topic) < len(filtered.kept):
            dropped[OFF_TOPIC] = len(filtered.kept) - len(on_topic)
        if len(recent) < len(on_topic):
            dropped[TOO_OLD] = len(on_topic) - len(recent)

        return FetchResult(articles=[_raw_article(item) for item in recent], dropped=dropped)


def _mention(name: str) -> re.Pattern[str]:
    """Finds the first word of the name's news name, as a whole word, in a folded title:
    "ASML" for "ASML Holding N.V.", which "ASM International" does not match."""
    first_word = news_name(name).split()[0]
    return re.compile(rf"\b{re.escape(fold(first_word))}\b")


def _raw_article(item: FeedItem) -> RawArticle:
    return RawArticle(
        url=item.url, title=item.title, publisher=item.publisher, published_at=item.published_at
    )
