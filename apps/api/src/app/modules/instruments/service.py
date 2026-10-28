import uuid
from collections.abc import Sequence

import structlog
from sqlalchemy import case, func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ProviderUnavailableError
from app.core.pagination import Cursor, PageRequest
from app.integrations.openfigi.client import OpenFigiClient
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.schemas import QuoteType
from app.modules.instruments.models import Instrument, InstrumentType
from app.modules.instruments.schemas import (
    InstrumentFilters,
    InstrumentResolve,
    InstrumentSearchResponse,
    InstrumentSearchResult,
    LocalSearchResult,
    YahooSearchResult,
)

logger = structlog.stdlib.get_logger(__name__)

SEARCH_LIMIT = 20
# Below this many stored matches, the search also asks Yahoo.
MIN_LOCAL_RESULTS = 5
INSTRUMENT_TYPES = {QuoteType.EQUITY: InstrumentType.STOCK, QuoteType.ETF: InstrumentType.ETF}


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


async def search_instruments(
    session: AsyncSession, yahoo: YahooClient, query: str
) -> InstrumentSearchResponse:
    """Stored instruments matching `query`, then Yahoo's if fewer than MIN_LOCAL_RESULTS match."""
    local: list[InstrumentSearchResult] = [
        LocalSearchResult.model_validate(instrument)
        for instrument in await _search_local(session, query)
    ]
    if len(local) >= MIN_LOCAL_RESULTS:
        return InstrumentSearchResponse(items=local, yahoo_unavailable=False)

    try:
        found = await yahoo.search(query)
    except ProviderUnavailableError:
        return InstrumentSearchResponse(items=local, yahoo_unavailable=True)

    # Get the Yahoo symbols of the stored instruments
    stored = set(
        await session.scalars(
            select(Instrument.yahoo_symbol).where(
                Instrument.yahoo_symbol.in_([result.yahoo_symbol for result in found])
            )
        )
    )
    candidates = [
        YahooSearchResult(
            yahoo_symbol=result.yahoo_symbol,
            name=result.name,
            exchange_code=result.exchange_code,
            type=INSTRUMENT_TYPES[result.quote_type],
        )
        for result in found
        # Only keep the Yahoo results that are not already stored.
        if result.yahoo_symbol not in stored
    ]
    return InstrumentSearchResponse(items=[*local, *candidates], yahoo_unavailable=False)


async def resolve_instrument(
    session: AsyncSession, yahoo: YahooClient, openfigi: OpenFigiClient, data: InstrumentResolve
) -> tuple[Instrument, bool]:
    """The instrument of a Yahoo symbol, stored first if needed; True if this call stored it."""
    stored = await _get_by_symbol(session, data.yahoo_symbol)
    if stored is not None:
        return stored, False

    details = await yahoo.get_details(data.yahoo_symbol)
    if details is None:
        raise NotFoundError(f"Yahoo Finance has no stock or ETF {data.yahoo_symbol}.")
    share_class_figi = await _share_class_figi(openfigi, data.yahoo_symbol)

    # Inserts nothing, and returns no row, if another request stored the symbol meanwhile.
    statement = (
        insert(Instrument)
        .values(
            type=INSTRUMENT_TYPES[details.quote_type],
            name=details.name,
            yahoo_symbol=data.yahoo_symbol,
            exchange_code=details.exchange_code,
            currency=details.currency,
            isin=data.isin,
            share_class_figi=share_class_figi,
        )
        .on_conflict_do_nothing(index_elements=[Instrument.yahoo_symbol])
        .returning(Instrument)
    )
    created = (await session.scalars(statement)).one_or_none()
    await session.commit()
    if created is None:
        stored = await _get_by_symbol(session, data.yahoo_symbol)
        if stored is None:
            raise RuntimeError(f"{data.yahoo_symbol} conflicted on insert but is not stored.")
        return stored, False

    await session.refresh(created)
    return created, True


async def _get_by_symbol(session: AsyncSession, yahoo_symbol: str) -> Instrument | None:
    return await session.scalar(select(Instrument).where(Instrument.yahoo_symbol == yahoo_symbol))


async def _share_class_figi(openfigi: OpenFigiClient, yahoo_symbol: str) -> str | None:
    """The symbol's share class FIGI; None, logged, if OpenFIGI has no single one or fails."""
    try:
        figi = await openfigi.get_share_class_figi(yahoo_symbol)
    except ProviderUnavailableError:
        logger.warning("instruments.figi_missing", yahoo_symbol=yahoo_symbol, reason="unavailable")
        return None

    if figi is None:
        logger.warning("instruments.figi_missing", yahoo_symbol=yahoo_symbol, reason="no_match")
    return figi


async def _search_local(session: AsyncSession, query: str) -> Sequence[Instrument]:
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
