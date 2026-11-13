import datetime as dt
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.overview.schemas import (
    OverviewTotals,
    PortfolioOverviewResponse,
    PositionOverview,
    UnvaluedPosition,
    UnvaluedReason,
)
from app.modules.portfolios.models import Portfolio
from app.modules.positions.models import Position
from app.modules.positions.schemas import PositionRead
from app.modules.positions.service import all_positions
from app.modules.prices.models import DailyPrice
from app.modules.prices.service import get_rate

HUNDRED = Decimal(100)


@dataclass(frozen=True)
class LatestClose:
    """An instrument's latest stored close and its date."""

    date: dt.date
    close: Decimal


@dataclass(frozen=True)
class Valuation:
    """A position's figures, unrounded."""

    position: Position
    latest: LatestClose | None
    # Base-currency units per unit of the instrument's currency; None when not looked up or
    # none is stored.
    rate: Decimal | None

    @property
    def value(self) -> Decimal | None:
        if self.position.quantity is None or self.latest is None:
            return None
        return self.position.quantity * self.latest.close

    @property
    def cost(self) -> Decimal | None:
        if self.position.quantity is None or self.position.average_price is None:
            return None
        return self.position.quantity * self.position.average_price

    @property
    def unrealised_gain(self) -> Decimal | None:
        value, cost = self.value, self.cost
        if value is None or cost is None:
            return None
        return value - cost

    @property
    def unrealised_gain_pct(self) -> Decimal | None:
        value, cost = self.value, self.cost
        if value is None or cost is None:
            return None
        return (value / cost - 1) * HUNDRED

    @property
    def value_base(self) -> Decimal | None:
        return self.in_base(self.value)

    @property
    def unvalued_reason(self) -> UnvaluedReason | None:
        """Why the position has no value in the base currency; None when it has one."""
        if self.position.quantity is None:
            return UnvaluedReason.NO_QUANTITY
        if self.latest is None:
            return UnvaluedReason.NO_PRICE
        if self.rate is None:
            return UnvaluedReason.NO_RATE
        return None

    def in_base(self, amount: Decimal | None) -> Decimal | None:
        if amount is None or self.rate is None:
            return None
        return amount * self.rate


async def get_overview(session: AsyncSession, portfolio: Portfolio) -> PortfolioOverviewResponse:
    """The portfolio's positions valued at their latest stored close, and their totals."""
    positions = await all_positions(session, portfolio)
    latest_closes = await _latest_closes(session, portfolio)

    rates: dict[tuple[str, dt.date], Decimal | None] = {}
    valuations: list[Valuation] = []
    for position in positions:
        latest = latest_closes.get(position.instrument_id)
        rate = None
        if position.quantity is not None and latest is not None:
            key = (position.instrument.currency, latest.date)
            if key not in rates:
                rates[key] = await get_rate(session, *key)
            rate = rates[key]
        valuations.append(Valuation(position, latest, rate))

    valued = sorted(
        (valuation for valuation in valuations if valuation.unvalued_reason is None),
        key=lambda valuation: (-(valuation.value_base or 0), valuation.position.id),
    )
    unvalued = sorted(
        (valuation for valuation in valuations if valuation.unvalued_reason is not None),
        key=lambda valuation: (valuation.position.instrument.yahoo_symbol, valuation.position.id),
    )
    total = _sum(valuation.value_base for valuation in valued)

    return PortfolioOverviewResponse(
        positions=[_position_overview(valuation, total) for valuation in [*valued, *unvalued]],
        totals=_totals(valued, unvalued, total),
    )


async def _latest_closes(
    session: AsyncSession, portfolio: Portfolio
) -> dict[uuid.UUID, LatestClose]:
    """The latest close of each instrument in the portfolio, by instrument id."""
    latest = (
        select(DailyPrice.date, DailyPrice.close)
        .where(DailyPrice.instrument_id == Position.instrument_id)
        .order_by(DailyPrice.date.desc())
        .limit(1)
        .lateral()
    )
    statement = (
        select(Position.instrument_id, latest.c.date, latest.c.close)
        .join(latest, true())
        .where(Position.portfolio_id == portfolio.id)
    )
    return {
        instrument_id: LatestClose(date=date, close=close)
        for instrument_id, date, close in await session.execute(statement)
    }


def _position_overview(valuation: Valuation, total: Decimal | None) -> PositionOverview:
    latest = valuation.latest
    return PositionOverview(
        position=PositionRead.model_validate(valuation.position),
        latest_close=latest.close if latest else None,
        latest_close_date=latest.date if latest else None,
        value=valuation.value,
        value_base=valuation.value_base,
        unrealised_gain=valuation.unrealised_gain,
        unrealised_gain_pct=valuation.unrealised_gain_pct,
        weight=_pct(valuation.value_base, total),
    )


def _totals(
    valued: Sequence[Valuation], unvalued: Sequence[Valuation], total: Decimal | None
) -> OverviewTotals:
    with_gain = [valuation for valuation in valued if valuation.cost is not None]
    gain = _sum(valuation.in_base(valuation.unrealised_gain) for valuation in with_gain)
    cost = _sum(valuation.in_base(valuation.cost) for valuation in with_gain)

    return OverviewTotals(
        base_currency=get_settings().base_currency,
        value_base=total,
        unrealised_gain_base=gain,
        unrealised_gain_base_pct=_pct(gain, cost),
        positions=len(valued) + len(unvalued),
        valued_positions=len(valued),
        prices_as_of=max(
            (valuation.latest.date for valuation in valued if valuation.latest), default=None
        ),
        unvalued=[
            UnvaluedPosition(position_id=valuation.position.id, reason=reason)
            for valuation in unvalued
            if (reason := valuation.unvalued_reason) is not None
        ],
    )


def _sum(amounts: Iterable[Decimal | None]) -> Decimal | None:
    """The sum of the amounts, or None when there are none."""
    present = [amount for amount in amounts if amount is not None]
    return sum(present, Decimal(0)) if present else None


def _pct(part: Decimal | None, whole: Decimal | None) -> Decimal | None:
    if part is None or not whole:
        return None
    return part / whole * HUNDRED
