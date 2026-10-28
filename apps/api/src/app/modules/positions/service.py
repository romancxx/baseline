import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import KeysetPage, PageRequest, paginate
from app.modules.instruments.service import get_instrument
from app.modules.portfolios.models import Portfolio
from app.modules.positions.models import Position
from app.modules.positions.schemas import PositionCreate, PositionUpdate


async def add_position(
    session: AsyncSession, portfolio: Portfolio, data: PositionCreate
) -> Position:
    await get_instrument(session, data.instrument_id)

    position = Position(portfolio_id=portfolio.id, **data.model_dump())
    session.add(position)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("This instrument is already in the portfolio.") from exc
    await session.refresh(position)
    return position


async def get_position(
    session: AsyncSession, portfolio: Portfolio, position_id: uuid.UUID
) -> Position:
    """The portfolio's position; one of another portfolio is reported as missing."""
    position = await session.scalar(
        select(Position).where(Position.id == position_id, Position.portfolio_id == portfolio.id)
    )
    if position is None:
        raise NotFoundError(f"Position {position_id} not found.")
    return position


async def list_positions(
    session: AsyncSession, portfolio: Portfolio, page: PageRequest
) -> KeysetPage[Position]:
    """One page of the portfolio's positions, newest first."""
    statement = select(Position).where(Position.portfolio_id == portfolio.id)
    return await paginate(session, statement, Position, page)


async def update_position(
    session: AsyncSession, position: Position, data: PositionUpdate
) -> Position:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(position, field, value)
    await session.commit()
    await session.refresh(position)
    return position


async def remove_position(session: AsyncSession, position: Position) -> None:
    await session.delete(position)
    await session.commit()
