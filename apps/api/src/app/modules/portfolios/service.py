import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolios.models import Portfolio

PORTFOLIO_NAME = "My portfolio"


def add_portfolio(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Add the user's portfolio to the session; the caller commits it with the user."""
    session.add(Portfolio(user_id=user_id, name=PORTFOLIO_NAME))


async def get_portfolio(session: AsyncSession, user_id: uuid.UUID) -> Portfolio:
    """The user's portfolio, created with the user."""
    return (await session.scalars(select(Portfolio).where(Portfolio.user_id == user_id))).one()
