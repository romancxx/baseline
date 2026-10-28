import uuid
from collections.abc import Sequence

from sqlalchemy import select, tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Cursor, PageRequest
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
) -> tuple[Sequence[Portfolio], Cursor | None]:
    """Return one page of the user's portfolios, newest first, and the cursor of the next page."""
    statement = select(Portfolio).where(Portfolio.user_id == user.id)
    if page.after is not None:
        statement = statement.where(
            tuple_(Portfolio.created_at, Portfolio.id) < (page.after.created_at, page.after.id)
        )

    statement = statement.order_by(Portfolio.created_at.desc(), Portfolio.id.desc())
    # One extra row tells whether a next page exists.
    rows = (await session.scalars(statement.limit(page.limit + 1))).all()
    portfolios = rows[: page.limit]
    if len(rows) <= page.limit:
        return portfolios, None
    last = portfolios[-1]
    return portfolios, Cursor(created_at=last.created_at, id=last.id)


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
