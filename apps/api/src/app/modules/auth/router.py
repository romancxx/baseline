from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import get_settings
from app.core.database import DbSession
from app.core.security import TOKEN_TYPE, create_access_token
from app.modules.auth.schemas import TokenResponse
from app.modules.auth.service import authenticate
from app.modules.users.schemas import UserCreate, UserRead
from app.modules.users.service import create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(session: DbSession, data: UserCreate) -> UserRead:
    user = await create_user(session, data)
    return UserRead.model_validate(user)


@router.post("/login")
async def login(
    session: DbSession, form: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> TokenResponse:
    """OAuth2 password flow: a form with `username` (the email) and `password`."""
    user = await authenticate(session, form.username, form.password)
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        token_type=TOKEN_TYPE,
        expires_in=get_settings().access_token_expire_minutes * 60,
    )
