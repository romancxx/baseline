from typing import Annotated

from fastapi import Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.service import get_portfolio


async def get_user_portfolio(session: DbSession, user: CurrentUser) -> Portfolio:
    """The current user's portfolio."""
    return await get_portfolio(session, user.id)


UserPortfolio = Annotated[Portfolio, Depends(get_user_portfolio)]
