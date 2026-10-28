import uuid
from typing import Annotated

from fastapi import Depends

from app.core.database import DbSession
from app.modules.portfolios.dependencies import OwnedPortfolio
from app.modules.positions.models import Position
from app.modules.positions.service import get_position


async def get_owned_position(
    session: DbSession, portfolio: OwnedPortfolio, position_id: uuid.UUID
) -> Position:
    """The `{position_id}` of the path, if it is in the current user's `{portfolio_id}`."""
    return await get_position(session, portfolio, position_id)


OwnedPosition = Annotated[Position, Depends(get_owned_position)]
