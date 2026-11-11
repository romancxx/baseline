from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

from app.core.config import API_PREFIX, get_settings
from app.core.database import engine
from app.core.error_handlers import EXCEPTION_HANDLERS
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware
from app.integrations.openfigi.client import OpenFigiClient
from app.modules.auth.router import router as auth_router
from app.modules.briefs.router import portfolio_router as portfolio_briefs_router
from app.modules.briefs.router import router as briefs_router
from app.modules.health.router import router as health_router
from app.modules.imports.router import router as imports_router
from app.modules.instruments.router import router as instruments_router
from app.modules.news.router import router as news_router
from app.modules.overview.router import router as overview_router
from app.modules.portfolios.router import router as portfolios_router
from app.modules.positions.router import router as positions_router
from app.modules.prices.router import router as prices_router
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

    api = APIRouter(prefix=API_PREFIX)
    api.include_router(health_router)
    api.include_router(auth_router)
    api.include_router(users_router)
    api.include_router(instruments_router)
    api.include_router(portfolios_router)
    api.include_router(positions_router)
    api.include_router(overview_router)
    api.include_router(imports_router)
    api.include_router(prices_router)
    api.include_router(news_router)
    api.include_router(briefs_router)
    api.include_router(portfolio_briefs_router)
    app.include_router(api)

    return app


app = create_app()
