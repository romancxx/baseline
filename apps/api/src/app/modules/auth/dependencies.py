import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.database import DbSession
from app.core.security import decode_access_token
from app.modules.auth.service import InvalidTokenError
from app.modules.users.models import User

# Reads "Authorization: Bearer <token>"; tokenUrl is where Swagger UI's Authorize button logs in.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    session: DbSession, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    user_id = _user_id(decode_access_token(token))
    user = await session.get(User, user_id) if user_id is not None else None
    if user is None:
        raise InvalidTokenError("The access token is invalid or has expired.")
    return user


def _user_id(subject: str | None) -> uuid.UUID | None:
    """The user id in a token's subject, or None if there is none or it is not a UUID."""
    if subject is None:
        return None
    try:
        return uuid.UUID(subject)
    except ValueError:
        return None


CurrentUser = Annotated[User, Depends(get_current_user)]
