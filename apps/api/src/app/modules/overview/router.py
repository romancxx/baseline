from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import get_current_user
from app.modules.overview.schemas import PortfolioOverviewResponse
from app.modules.overview.service import get_overview
from app.modules.portfolios.dependencies import UserPortfolio

router = APIRouter(
    prefix="/portfolio/overview", tags=["overview"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def get_mine(session: DbSession, portfolio: UserPortfolio) -> PortfolioOverviewResponse:
    return await get_overview(session, portfolio)
