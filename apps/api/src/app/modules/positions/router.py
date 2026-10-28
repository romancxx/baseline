from fastapi import APIRouter, Depends, status

from app.core.database import DbSession
from app.core.pagination import Page, Pagination
from app.modules.auth.dependencies import get_current_user
from app.modules.portfolios.dependencies import OwnedPortfolio
from app.modules.positions.dependencies import OwnedPosition
from app.modules.positions.schemas import PositionCreate, PositionRead, PositionUpdate
from app.modules.positions.service import (
    add_position,
    list_positions,
    remove_position,
    update_position,
)

router = APIRouter(
    prefix="/portfolios/{portfolio_id}/positions",
    tags=["positions"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def add(session: DbSession, portfolio: OwnedPortfolio, data: PositionCreate) -> PositionRead:
    position = await add_position(session, portfolio, data)
    return PositionRead.model_validate(position)


@router.get("")
async def list_in_portfolio(
    session: DbSession, portfolio: OwnedPortfolio, page: Pagination
) -> Page[PositionRead]:
    positions = await list_positions(session, portfolio, page)
    return positions.to_page(PositionRead)


@router.patch("/{position_id}")
async def update(session: DbSession, position: OwnedPosition, data: PositionUpdate) -> PositionRead:
    position = await update_position(session, position, data)
    return PositionRead.model_validate(position)


@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(session: DbSession, position: OwnedPosition) -> None:
    await remove_position(session, position)
