import datetime as dt
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel


class QuoteType(StrEnum):
    """The Yahoo quote types Baseline lists."""

    EQUITY = "EQUITY"
    ETF = "ETF"


class SearchResult(BaseModel):
    yahoo_symbol: str
    name: str
    exchange_code: str
    quote_type: QuoteType


class ListingDetails(BaseModel):
    name: str
    exchange_code: str
    # ISO 4217, e.g. GBP for a listing Yahoo quotes in pence.
    currency: str
    # Converts Yahoo's prices into `currency`: 0.01 for pence, 1 otherwise.
    price_factor: Decimal
    quote_type: QuoteType


class DailyBar(BaseModel):
    """One trading day, with prices in the listing's currency."""

    # The trading day at the exchange.
    date: dt.date
    open: Decimal
    high: Decimal
    low: Decimal
    # Adjusted for splits only; adj_close is also adjusted for dividends.
    close: Decimal
    adj_close: Decimal
    # None when Yahoo has no volume for the day.
    volume: int | None


class Split(BaseModel):
    date: dt.date
    # New shares per old share: 10 for a 10-for-1 split, 0.5 for a 1-for-2 reverse split.
    ratio: Decimal


class PriceHistory(BaseModel):
    """Daily bars, oldest first, and the splits on those days."""

    bars: list[DailyBar]
    splits: list[Split]


class RecentBars(BaseModel):
    # By Yahoo symbol, for each requested symbol with at least one bar.
    histories: dict[str, PriceHistory]
    # The requested symbols Yahoo returned no bar for.
    missing: list[str]
    # The error message, by requested symbol Yahoo failed on.
    failed: dict[str, str]
