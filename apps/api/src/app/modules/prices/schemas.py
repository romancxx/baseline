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
