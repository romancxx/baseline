import uuid
from typing import Annotated

from fastapi import Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.service import get_portfolio


async def get_owned_portfolio(
    session: DbSession, user: CurrentUser, portfolio_id: uuid.UUID
) -> Portfolio:
    """The `{portfolio_id}` of the path, if it belongs to the current user; 404 otherwise."""
    return await get_portfolio(session, user, portfolio_id)


OwnedPortfolio = Annotated[Portfolio, Depends(get_owned_portfolio)]
