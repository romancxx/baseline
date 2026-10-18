from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.database import engine
from app.core.error_handlers import EXCEPTION_HANDLERS
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.instruments.router import router as instruments_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.environment)

    app = FastAPI(
        title="StockNews API",
        debug=settings.debug,
        lifespan=lifespan,
        exception_handlers=EXCEPTION_HANDLERS,
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(instruments_router, prefix="/api/v1")

    return app


app = create_app()
