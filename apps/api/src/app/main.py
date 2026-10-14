from fastapi import FastAPI

from app.core.config import get_settings
from app.modules.health.router import router as health_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="StockNews API", debug=settings.debug)
    app.include_router(health_router, prefix="/api/v1")

    return app


app = create_app()
