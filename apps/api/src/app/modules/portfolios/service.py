from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolios.models import Portfolio
from app.modules.users.models import User


async def get_portfolio(session: AsyncSession, user: User) -> Portfolio:
    """The user's portfolio, created with the user."""
    return (await session.scalars(select(Portfolio).where(Portfolio.user_id == user.id))).one()
