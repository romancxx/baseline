from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.portfolios.dependencies import UserPortfolio
from app.modules.portfolios.schemas import PortfolioRead

router = APIRouter(
    prefix="/portfolio", tags=["portfolios"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def get_mine(portfolio: UserPortfolio) -> PortfolioRead:
    return PortfolioRead.model_validate(portfolio)
