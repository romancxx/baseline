import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DailyPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: dt.date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    adj_close: Decimal
    volume: int | None


class DailyPricesResponse(BaseModel):
    """The bars of a date range, oldest first."""

    items: list[DailyPriceRead]


class PriceUpdateSummary(BaseModel):
    """What one price update did, by Yahoo symbol."""

    # Full history stored: the instrument had no prices, or a split was reported.
    backfilled: list[str]
    # Recent bars stored.
    updated: list[str]
    # Why nothing was stored for the symbol.
    failed: dict[str, str]


class RateUpdateSummary(BaseModel):
    """What one FX rate update did, by currency."""

    # Recent rates stored.
    updated: list[str]
    # Why no rate was stored for the currency.
    failed: dict[str, str]
