from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.core.security import hash_password
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate


async def create_user(session: AsyncSession, data: UserCreate) -> User:
    user = User(email=data.email, hashed_password=hash_password(data.password))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("An account with this email already exists.") from exc
    await session.refresh(user)
    return user
