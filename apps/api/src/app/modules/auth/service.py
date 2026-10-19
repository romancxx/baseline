from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import DUMMY_PASSWORD_HASH, verify_password
from app.modules.users.models import User


class InvalidCredentialsError(UnauthorizedError):
    code = "invalid_credentials"


class InvalidTokenError(UnauthorizedError):
    code = "invalid_token"


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Return the user with this email and password; the same error for either being wrong."""
    user = await session.scalar(select(User).where(User.email == email.strip().lower()))
    password_matches = verify_password(
        password, user.hashed_password if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_matches:
        raise InvalidCredentialsError("Incorrect email or password.")
    return user
