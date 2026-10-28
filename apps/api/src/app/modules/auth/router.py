import uuid
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import API_PREFIX, get_settings
from app.core.database import DbSession
from app.core.security import TOKEN_TYPE, create_access_token
from app.modules.auth.schemas import TokenResponse
from app.modules.auth.service import (
    authenticate,
    issue_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.modules.users.schemas import UserCreate, UserRead
from app.modules.users.service import create_user

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
# Browsers send the cookie only to /auth/refresh and /auth/logout.
REFRESH_COOKIE_PATH = f"{API_PREFIX}{router.prefix}"

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(session: DbSession, data: UserCreate) -> UserRead:
    user = await create_user(session, data)
    return UserRead.model_validate(user)


@router.post("/login")
async def login(
    session: DbSession,
    response: Response,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> TokenResponse:
    """OAuth2 password flow: a form with `username` (the email) and `password`."""
    user = await authenticate(session, form.username, form.password)
    refresh_token = await issue_refresh_token(session, user.id)
    return _issue_tokens(response, user.id, refresh_token)


@router.post("/refresh")
async def refresh(
    session: DbSession, response: Response, refresh_token: RefreshCookie = None
) -> TokenResponse:
    user_id, new_refresh_token = await rotate_refresh_token(session, refresh_token)
    return _issue_tokens(response, user_id, new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    session: DbSession, response: Response, refresh_token: RefreshCookie = None
) -> None:
    if refresh_token is not None:
        await revoke_refresh_token(session, refresh_token)
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, secure=True, httponly=True, samesite="strict"
    )


def _issue_tokens(response: Response, user_id: uuid.UUID, refresh_token: str) -> TokenResponse:
    """Set the refresh token cookie and return a new access token."""
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )
    return TokenResponse(
        access_token=create_access_token(str(user_id)),
        token_type=TOKEN_TYPE,
        expires_in=settings.access_token_expire_minutes * 60,
    )
