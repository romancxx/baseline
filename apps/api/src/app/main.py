from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.database import engine
from app.core.error_handlers import EXCEPTION_HANDLERS
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware
from app.integrations.openfigi.client import OpenFigiClient
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.instruments.router import router as instruments_router
from app.modules.portfolios.router import router as portfolios_router
from app.modules.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    openfigi = OpenFigiClient(get_settings().openfigi_api_key)
    app.state.openfigi = openfigi
    yield
    await openfigi.aclose()
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
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(instruments_router, prefix="/api/v1")
    app.include_router(portfolios_router, prefix="/api/v1")

    return app


app = create_app()
