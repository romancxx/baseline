import datetime as dt
import uuid
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

from app.modules.positions.schemas import PositionRead

TWO_PLACES = Decimal("0.01")


def _round_for_display(value: Decimal) -> Decimal:
    """`value` to 2 places, halves rounded up, never a negative zero."""
    rounded = value.quantize(TWO_PLACES, ROUND_HALF_UP)
    return rounded.copy_abs() if rounded.is_zero() else rounded


# Computed amounts, rounded only when the response is serialized.
Money = Annotated[Decimal, PlainSerializer(_round_for_display, return_type=Decimal)]
# In percent: 1.91 is 1.91 %.
Percent = Annotated[Decimal, PlainSerializer(_round_for_display, return_type=Decimal)]


class PositionOverview(BaseModel):
    position: PositionRead
    # The latest stored bar's close and date.
    latest_close: Decimal | None
    latest_close_date: dt.date | None
    # Amounts without a `_base` suffix are in the instrument's currency.
    value: Money | None
    value_base: Money | None
    unrealised_gain: Money | None
    unrealised_gain_pct: Percent | None
    # Share of the total `value_base`.
    weight: Percent | None


class UnvaluedReason(StrEnum):
    NO_QUANTITY = "no_quantity"
    # No bar stored yet.
    NO_PRICE = "no_price"
    # No rate of the instrument's currency on or before its latest close.
    NO_RATE = "no_rate"


class UnvaluedPosition(BaseModel):
    position_id: uuid.UUID
    reason: UnvaluedReason


class OverviewTotals(BaseModel):
    """Totals over the valued positions, in the base currency; null when none counts."""

    base_currency: str
    value_base: Money | None
    unrealised_gain_base: Money | None
    # Against the cost of the positions with a gain.
    unrealised_gain_base_pct: Percent | None
    positions: int
    valued_positions: int
    # The latest close date among the valued positions.
    prices_as_of: dt.date | None
    unvalued: list[UnvaluedPosition]


class PortfolioOverviewResponse(BaseModel):
    """Every position of the portfolio, largest value first, then those not valued."""

    positions: list[PositionOverview]
    totals: OverviewTotals
