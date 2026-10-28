import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import KeysetPage, PageRequest, paginate
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioUpdate
from app.modules.users.models import User


async def create_portfolio(session: AsyncSession, user: User, data: PortfolioCreate) -> Portfolio:
    portfolio = Portfolio(user_id=user.id, name=data.name)
    session.add(portfolio)
    await _commit(session)
    await session.refresh(portfolio)
    return portfolio


async def get_portfolio(session: AsyncSession, user: User, portfolio_id: uuid.UUID) -> Portfolio:
    """The user's portfolio; another user's is reported as missing, like an unknown id."""
    portfolio = await session.scalar(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == user.id)
    )
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id} not found.")
    return portfolio


async def list_portfolios(
    session: AsyncSession, user: User, page: PageRequest
) -> KeysetPage[Portfolio]:
    """One page of the user's portfolios, newest first."""
    statement = select(Portfolio).where(Portfolio.user_id == user.id)
    return await paginate(session, statement, Portfolio, page)


async def update_portfolio(
    session: AsyncSession, portfolio: Portfolio, data: PortfolioUpdate
) -> Portfolio:
    # None means "leave unchanged": no column of a portfolio is nullable.
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(portfolio, field, value)
    await _commit(session)
    await session.refresh(portfolio)
    return portfolio


async def delete_portfolio(session: AsyncSession, portfolio: Portfolio) -> None:
    await session.delete(portfolio)
    await session.commit()


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("You already have a portfolio with this name.") from exc
