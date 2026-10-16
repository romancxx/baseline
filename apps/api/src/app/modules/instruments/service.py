import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.instruments.models import Instrument
from app.modules.instruments.schemas import InstrumentCreate, InstrumentUpdate


async def create_instrument(session: AsyncSession, data: InstrumentCreate) -> Instrument:
    instrument = Instrument(**data.model_dump())
    session.add(instrument)
    await _commit(session)
    await session.refresh(instrument)
    return instrument


async def get_instrument(session: AsyncSession, instrument_id: uuid.UUID) -> Instrument:
    instrument = await session.get(Instrument, instrument_id)
    if instrument is None:
        raise NotFoundError(f"Instrument {instrument_id} not found.")
    return instrument


async def list_instruments(session: AsyncSession) -> Sequence[Instrument]:
    result = await session.scalars(
        select(Instrument).order_by(Instrument.symbol, Instrument.exchange)
    )
    return result.all()


async def update_instrument(
    session: AsyncSession, instrument_id: uuid.UUID, data: InstrumentUpdate
) -> Instrument:
    instrument = await get_instrument(session, instrument_id)
    # None means "leave unchanged": none of these columns is nullable.
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(instrument, field, value)
    await _commit(session)
    await session.refresh(instrument)
    return instrument


async def delete_instrument(session: AsyncSession, instrument_id: uuid.UUID) -> None:
    instrument = await get_instrument(session, instrument_id)
    await session.delete(instrument)
    await session.commit()


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("An instrument with this symbol and exchange already exists.") from exc
