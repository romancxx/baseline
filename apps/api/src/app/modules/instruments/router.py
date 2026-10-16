import uuid

from fastapi import APIRouter, status

from app.core.database import DbSession
from app.modules.instruments.schemas import InstrumentCreate, InstrumentRead, InstrumentUpdate
from app.modules.instruments.service import (
    create_instrument,
    delete_instrument,
    get_instrument,
    list_instruments,
    update_instrument,
)

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(session: DbSession, data: InstrumentCreate) -> InstrumentRead:
    instrument = await create_instrument(session, data)
    return InstrumentRead.model_validate(instrument)


@router.get("")
async def list_all(session: DbSession) -> list[InstrumentRead]:
    instruments = await list_instruments(session)
    return [InstrumentRead.model_validate(instrument) for instrument in instruments]


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
