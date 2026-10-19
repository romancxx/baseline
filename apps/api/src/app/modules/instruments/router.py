import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.database import DbSession
from app.core.pagination import Page, Pagination, encode_cursor
from app.modules.auth.dependencies import get_current_user
from app.modules.instruments.schemas import (
    InstrumentCreate,
    InstrumentFilters,
    InstrumentRead,
    InstrumentUpdate,
)
from app.modules.instruments.service import (
    create_instrument,
    delete_instrument,
    get_instrument,
    list_instruments,
    update_instrument,
)

router = APIRouter(
    prefix="/instruments", tags=["instruments"], dependencies=[Depends(get_current_user)]
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(session: DbSession, data: InstrumentCreate) -> InstrumentRead:
    instrument = await create_instrument(session, data)
    return InstrumentRead.model_validate(instrument)


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


@router.patch("/{instrument_id}")
async def update(
    session: DbSession, instrument_id: uuid.UUID, data: InstrumentUpdate
) -> InstrumentRead:
    instrument = await update_instrument(session, instrument_id, data)
    return InstrumentRead.model_validate(instrument)


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(session: DbSession, instrument_id: uuid.UUID) -> None:
    await delete_instrument(session, instrument_id)
