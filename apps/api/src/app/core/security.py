from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

# Argon2id with pwdlib's recommended parameters; they are stored inside each hash.
password_hash = PasswordHash.recommended()

# Compared against when no user matches, so a login takes as long whether or not the email exists.
DUMMY_PASSWORD_HASH = password_hash.hash("not-a-real-password")

JWT_ALGORITHM = "HS256"
TOKEN_TYPE = "bearer"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(subject: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    # PyJWT's `key` type names cryptography's key classes, which are not installed.
    return jwt.encode(  # pyright: ignore[reportUnknownMemberType]
        payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM
    )


def decode_access_token(token: str) -> str | None:
    """Return the token's subject, or None if the token is malformed, tampered with or expired."""
    try:
        payload = jwt.decode(  # pyright: ignore[reportUnknownMemberType]
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "iat", "exp"]},
        )
    except jwt.InvalidTokenError:
        return None
    return payload["sub"]
