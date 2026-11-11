import uuid

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import get_current_user
from app.modules.briefs.schemas import BriefRead, PortfolioBriefsResponse
from app.modules.briefs.service import get_latest_brief, list_portfolio_briefs
from app.modules.portfolios.dependencies import UserPortfolio

router = APIRouter(
    prefix="/instruments/{instrument_id}/brief",
    tags=["briefs"],
    dependencies=[Depends(get_current_user)],
)
portfolio_router = APIRouter(
    prefix="/portfolio/briefs", tags=["briefs"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def get_latest(session: DbSession, instrument_id: uuid.UUID) -> BriefRead:
    brief = await get_latest_brief(session, instrument_id)
    return BriefRead.model_validate(brief)


@portfolio_router.get("")
async def list_mine(session: DbSession, portfolio: UserPortfolio) -> PortfolioBriefsResponse:
    return await list_portfolio_briefs(session, portfolio)
