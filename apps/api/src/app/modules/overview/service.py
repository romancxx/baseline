import datetime as dt
import uuid
from collections import defaultdict
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
from app.modules.prices.models import DailyPrice
from app.modules.prices.service import MissingRateError, convert

HUNDRED = Decimal(100)


@dataclass(frozen=True)
class Closes:
    """An instrument's latest stored close, its date, and the close of the bar before it."""

    date: dt.date
    latest: Decimal
    previous: Decimal | None


@dataclass(frozen=True)
class Valuation:
    """A position's figures, unrounded."""

    position: Position
    closes: Closes | None
    # Base-currency units per unit of the instrument's currency; None when not looked up or
    # none is stored.
    rate: Decimal | None

    @property
    def value(self) -> Decimal | None:
        if self.position.quantity is None or self.closes is None:
            return None
        return self.position.quantity * self.closes.latest

    @property
    def day_change(self) -> Decimal | None:
        if self.position.quantity is None or self.closes is None or self.closes.previous is None:
            return None
        return self.position.quantity * (self.closes.latest - self.closes.previous)

    @property
    def day_change_pct(self) -> Decimal | None:
        if self.closes is None or self.closes.previous is None:
            return None
        return (self.closes.latest / self.closes.previous - 1) * HUNDRED

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
        if self.closes is None:
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
    positions = (
        await session.scalars(select(Position).where(Position.portfolio_id == portfolio.id))
    ).all()
    closes = await _latest_closes(session, portfolio)

    rates: dict[tuple[str, dt.date], Decimal | None] = {}
    valuations: list[Valuation] = []
    for position in positions:
        position_closes = closes.get(position.instrument_id)
        rate = None
        if position.quantity is not None and position_closes is not None:
            key = (position.instrument.currency, position_closes.date)
            if key not in rates:
                rates[key] = await _rate(session, *key)
            rate = rates[key]
        valuations.append(Valuation(position, position_closes, rate))

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


async def _latest_closes(session: AsyncSession, portfolio: Portfolio) -> dict[uuid.UUID, Closes]:
    """The latest two closes of each instrument in the portfolio, by instrument id."""
    # Read backwards through the primary key, two rows per instrument.
    bars = (
        select(DailyPrice.date, DailyPrice.close)
        .where(DailyPrice.instrument_id == Position.instrument_id)
        .order_by(DailyPrice.date.desc())
        .limit(2)
        .lateral()
    )
    statement = (
        select(Position.instrument_id, bars.c.date, bars.c.close)
        .join(bars, true())
        .where(Position.portfolio_id == portfolio.id)
        .order_by(Position.instrument_id, bars.c.date.desc())
    )

    by_instrument: defaultdict[uuid.UUID, list[tuple[dt.date, Decimal]]] = defaultdict(list)
    for instrument_id, date, close in await session.execute(statement):
        by_instrument[instrument_id].append((date, close))

    return {
        instrument_id: Closes(
            date=bars[0][0], latest=bars[0][1], previous=bars[1][1] if len(bars) > 1 else None
        )
        for instrument_id, bars in by_instrument.items()
    }


async def _rate(session: AsyncSession, currency: str, on_date: dt.date) -> Decimal | None:
    """Base-currency units per unit of `currency` on or before `on_date`; None when none."""
    try:
        return await convert(session, Decimal(1), currency, on_date)
    except MissingRateError:
        return None


def _position_overview(valuation: Valuation, total: Decimal | None) -> PositionOverview:
    closes = valuation.closes
    value_base = valuation.value_base
    return PositionOverview(
        position=PositionRead.model_validate(valuation.position),
        latest_close=closes.latest if closes else None,
        latest_close_date=closes.date if closes else None,
        previous_close=closes.previous if closes else None,
        day_change=valuation.day_change,
        day_change_pct=valuation.day_change_pct,
        value=valuation.value,
        value_base=value_base,
        unrealised_gain=valuation.unrealised_gain,
        unrealised_gain_pct=valuation.unrealised_gain_pct,
        weight=value_base / total * HUNDRED if value_base is not None and total else None,
    )


def _totals(
    valued: Sequence[Valuation], unvalued: Sequence[Valuation], total: Decimal | None
) -> OverviewTotals:
    with_day_change = [valuation for valuation in valued if valuation.day_change is not None]
    day_change = _sum(valuation.in_base(valuation.day_change) for valuation in with_day_change)
    previous_value = _sum(valuation.value_base for valuation in with_day_change)

    with_gain = [valuation for valuation in valued if valuation.cost is not None]
    gain = _sum(valuation.in_base(valuation.unrealised_gain) for valuation in with_gain)
    cost = _sum(valuation.in_base(valuation.cost) for valuation in with_gain)

    if day_change is not None and previous_value is not None:
        previous_value -= day_change

    return OverviewTotals(
        base_currency=get_settings().base_currency,
        value_base=total,
        day_change_base=day_change,
        day_change_base_pct=_pct(day_change, previous_value),
        unrealised_gain_base=gain,
        unrealised_gain_base_pct=_pct(gain, cost),
        positions=len(valued) + len(unvalued),
        valued_positions=len(valued),
        prices_as_of=max(
            (valuation.closes.date for valuation in valued if valuation.closes), default=None
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
