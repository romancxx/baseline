from fastapi import APIRouter, Depends, status

from app.core.database import DbSession
from app.core.pagination import Page, Pagination, encode_cursor
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.portfolios.dependencies import OwnedPortfolio
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioRead, PortfolioUpdate
from app.modules.portfolios.service import (
    create_portfolio,
    delete_portfolio,
    list_portfolios,
    update_portfolio,
)

router = APIRouter(
    prefix="/portfolios", tags=["portfolios"], dependencies=[Depends(get_current_user)]
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(session: DbSession, user: CurrentUser, data: PortfolioCreate) -> PortfolioRead:
    portfolio = await create_portfolio(session, user, data)
    return PortfolioRead.model_validate(portfolio)


@router.get("")
async def list_mine(session: DbSession, user: CurrentUser, page: Pagination) -> Page[PortfolioRead]:
    portfolios, next_cursor = await list_portfolios(session, user, page)
    return Page[PortfolioRead](
        items=[PortfolioRead.model_validate(portfolio) for portfolio in portfolios],
        next_cursor=encode_cursor(next_cursor) if next_cursor else None,
    )


@router.get("/{portfolio_id}")
async def get_one(portfolio: OwnedPortfolio) -> PortfolioRead:
    return PortfolioRead.model_validate(portfolio)


@router.patch("/{portfolio_id}")
async def rename(
    session: DbSession, portfolio: OwnedPortfolio, data: PortfolioUpdate
) -> PortfolioRead:
    portfolio = await update_portfolio(session, portfolio, data)
    return PortfolioRead.model_validate(portfolio)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(session: DbSession, portfolio: OwnedPortfolio) -> None:
    await delete_portfolio(session, portfolio)
