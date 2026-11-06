from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.core.security import hash_password
from app.modules.portfolios.models import Portfolio
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate

PORTFOLIO_NAME = "My portfolio"


async def create_user(session: AsyncSession, data: UserCreate) -> User:
    """Create the user and their portfolio, in one transaction."""
    user = User(email=data.email, hashed_password=hash_password(data.password))
    session.add(user)
    try:
        # Inserts the user, so that the database gives it its id.
        await session.flush()
        session.add(Portfolio(user_id=user.id, name=PORTFOLIO_NAME))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("An account with this email already exists.") from exc
    await session.refresh(user)
    return user
