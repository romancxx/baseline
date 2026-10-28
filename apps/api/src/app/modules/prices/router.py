import uuid

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.modules.auth.dependencies import get_current_user
from app.modules.prices.dependencies import PriceRange
from app.modules.prices.schemas import DailyPriceRead, DailyPricesResponse
from app.modules.prices.service import list_prices

router = APIRouter(
    prefix="/instruments/{instrument_id}/prices",
    tags=["prices"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
async def list_in_range(
    session: DbSession, instrument_id: uuid.UUID, dates: PriceRange
) -> DailyPricesResponse:
    prices = await list_prices(session, instrument_id, dates.start, dates.end)
    return DailyPricesResponse(items=[DailyPriceRead.model_validate(price) for price in prices])
