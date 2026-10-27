import uuid
from collections.abc import Sequence

from sqlalchemy import case, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.pagination import Cursor, PageRequest
from app.modules.instruments.models import Instrument
from app.modules.instruments.schemas import InstrumentFilters

SEARCH_LIMIT = 20


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
    if filters.exchange_code is not None:
        statement = statement.where(Instrument.exchange_code == filters.exchange_code)
    if filters.symbol_prefix is not None:
        statement = statement.where(
            Instrument.yahoo_symbol.startswith(filters.symbol_prefix, autoescape=True)
        )
    if filters.share_class_figi is not None:
        statement = statement.where(Instrument.share_class_figi == filters.share_class_figi)
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


async def search_instruments(session: AsyncSession, query: str) -> Sequence[Instrument]:
    """Instruments matching `query`: its ISIN first, then symbols it starts, then similar names."""
    isin_match = Instrument.isin == query.upper()
    # Symbols are stored uppercase, so an uppercased prefix makes the match case-insensitive.
    symbol_match = Instrument.yahoo_symbol.startswith(query.upper(), autoescape=True)
    # pg_trgm's `name %> query`: some words of the name are similar to the query.
    name_match = Instrument.name.bool_op("%>")(query)

    rank = case((isin_match, 0), (symbol_match, 1), else_=2)
    statement = (
        select(Instrument)
        .where(or_(isin_match, symbol_match, name_match))
        .order_by(
            rank,
            func.word_similarity(query, Instrument.name).desc(),
            Instrument.yahoo_symbol,
        )
        .limit(SEARCH_LIMIT)
    )
    return (await session.scalars(statement)).all()
