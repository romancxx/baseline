import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    generate_refresh_token,
    hash_refresh_token,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.users.models import User

logger = structlog.stdlib.get_logger(__name__)


class InvalidCredentialsError(UnauthorizedError):
    code = "invalid_credentials"


class InvalidTokenError(UnauthorizedError):
    code = "invalid_token"


class InvalidRefreshTokenError(UnauthorizedError):
    code = "invalid_refresh_token"

    def __init__(self) -> None:
        super().__init__("The refresh token is missing, invalid, expired or revoked.")


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Return the user with this email and password; the same error for either being wrong."""
    user = await session.scalar(select(User).where(User.email == email.strip().lower()))
    password_matches = verify_password(
        password, user.hashed_password if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_matches:
        raise InvalidCredentialsError("Incorrect email or password.")
    return user


async def issue_refresh_token(session: AsyncSession, user_id: uuid.UUID) -> str:
    """Store a new refresh token for the user and return it; only its hash is kept."""
    token = generate_refresh_token()
    lifetime = timedelta(days=get_settings().refresh_token_expire_days)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(token),
            expires_at=datetime.now(UTC) + lifetime,
        )
    )
    await session.commit()
    return token


async def rotate_refresh_token(session: AsyncSession, token: str | None) -> tuple[uuid.UUID, str]:
    """Revoke `token` and issue its replacement; return the user id and the new token.

    A token that was already revoked is being reused, which means it was copied: every
    refresh token of that user is revoked, so both the thief and the user must log in again.
    """
    if token is None:
        raise InvalidRefreshTokenError
    now = datetime.now(UTC)
    # FOR UPDATE: a concurrent rotation of the same token waits, then sees it revoked.
    record = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(token))
        .with_for_update()
    )
    if record is None:
        raise InvalidRefreshTokenError
    if record.revoked_at is not None:
        await _revoke_all(session, record.user_id, now)
        logger.warning("auth.refresh_token_reused", user_id=str(record.user_id))
        raise InvalidRefreshTokenError
    if record.expires_at <= now:
        raise InvalidRefreshTokenError

    record.revoked_at = now
    # Commits the revocation and the new token together.
    return record.user_id, await issue_refresh_token(session, record.user_id)


async def revoke_refresh_token(session: AsyncSession, token: str) -> None:
    """Revoke `token` if it is still usable; an unknown or already revoked token is ignored."""
    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(token),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await session.commit()


async def _revoke_all(session: AsyncSession, user_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await session.commit()
