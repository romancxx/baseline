from fastapi import APIRouter, status

from app.core.database import DbSession
from app.modules.users.schemas import UserCreate, UserRead
from app.modules.users.service import create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(session: DbSession, data: UserCreate) -> UserRead:
    user = await create_user(session, data)
    return UserRead.model_validate(user)
