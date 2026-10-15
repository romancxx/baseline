import uuid

from fastapi import APIRouter, HTTPException, status

from app.core.database import DbSession
from app.modules.instruments.schemas import InstrumentCreate, InstrumentRead, InstrumentUpdate
from app.modules.instruments.service import (
    DuplicateInstrumentError,
    create_instrument,
    delete_instrument,
    get_instrument,
    list_instruments,
    update_instrument,
)

router = APIRouter(prefix="/instruments", tags=["instruments"])

NOT_FOUND = "Instrument not found"
DUPLICATE = "An instrument with this symbol and exchange already exists"


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(session: DbSession, data: InstrumentCreate) -> InstrumentRead:
    try:
        instrument = await create_instrument(session, data)
    except DuplicateInstrumentError:
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return InstrumentRead.model_validate(instrument)


@router.get("")
async def list_all(session: DbSession) -> list[InstrumentRead]:
    instruments = await list_instruments(session)
    return [InstrumentRead.model_validate(instrument) for instrument in instruments]


@router.get("/{instrument_id}")
async def get_one(session: DbSession, instrument_id: uuid.UUID) -> InstrumentRead:
    instrument = await get_instrument(session, instrument_id)
    if instrument is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return InstrumentRead.model_validate(instrument)


@router.patch("/{instrument_id}")
async def update(
    session: DbSession, instrument_id: uuid.UUID, data: InstrumentUpdate
) -> InstrumentRead:
    instrument = await get_instrument(session, instrument_id)
    if instrument is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    try:
        instrument = await update_instrument(session, instrument, data)
    except DuplicateInstrumentError:
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE) from None
    return InstrumentRead.model_validate(instrument)


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(session: DbSession, instrument_id: uuid.UUID) -> None:
    instrument = await get_instrument(session, instrument_id)
    if instrument is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    await delete_instrument(session, instrument)
