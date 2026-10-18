import uuid
from collections.abc import Sequence

from sqlalchemy import select, tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import Cursor, PageRequest
from app.modules.instruments.models import Instrument
from app.modules.instruments.schemas import InstrumentCreate, InstrumentFilters, InstrumentUpdate


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


async def list_instruments(
    session: AsyncSession, filters: InstrumentFilters, page: PageRequest
) -> tuple[Sequence[Instrument], Cursor | None]:
    """Return one page of instruments, newest first, and the cursor of the next page."""
    statement = select(Instrument)
    if filters.type is not None:
        statement = statement.where(Instrument.type == filters.type)
    if filters.exchange is not None:
        statement = statement.where(Instrument.exchange == filters.exchange)
    if filters.symbol_prefix is not None:
        statement = statement.where(
            Instrument.symbol.startswith(filters.symbol_prefix, autoescape=True)
        )
    if page.after is not None:
        statement = statement.where(
            tuple_(Instrument.created_at, Instrument.id) < (page.after.created_at, page.after.id)
        )

    statement = statement.order_by(Instrument.created_at.desc(), Instrument.id.desc())
    # One extra row tells whether a next page exists.
    rows = (await session.scalars(statement.limit(page.limit + 1))).all()
    instruments = rows[: page.limit]
    if len(rows) <= page.limit:
        return instruments, None
    last = instruments[-1]
    return instruments, Cursor(created_at=last.created_at, id=last.id)


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
