from fastapi import APIRouter, FastAPI
from pydantic import BaseModel

from app.config import get_settings


class HealthResponse(BaseModel):
    status: str


settings = get_settings()

app = FastAPI(title="StockNews API", debug=settings.debug)
router = APIRouter()


@router.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


app.include_router(router, prefix="/api/v1")
