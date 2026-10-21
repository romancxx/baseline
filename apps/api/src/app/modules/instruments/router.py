import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.database import DbSession
from app.core.pagination import Page, Pagination, encode_cursor
from app.modules.auth.dependencies import get_current_user
from app.modules.instruments.schemas import InstrumentFilters, InstrumentRead
from app.modules.instruments.service import get_instrument, list_instruments

router = APIRouter(
    prefix="/instruments", tags=["instruments"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def list_all(
    session: DbSession, filters: Annotated[InstrumentFilters, Depends()], page: Pagination
) -> Page[InstrumentRead]:
    instruments, next_cursor = await list_instruments(session, filters, page)
    return Page[InstrumentRead](
        items=[InstrumentRead.model_validate(instrument) for instrument in instruments],
        next_cursor=encode_cursor(next_cursor) if next_cursor else None,
    )


@router.get("/{instrument_id}")
async def get_one(session: DbSession, instrument_id: uuid.UUID) -> InstrumentRead:
    instrument = await get_instrument(session, instrument_id)
    return InstrumentRead.model_validate(instrument)
