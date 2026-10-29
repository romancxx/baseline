import uuid
from collections.abc import Sequence
from dataclasses import dataclass

import structlog
from sqlalchemy import case, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ProviderUnavailableError
from app.core.pagination import KeysetPage, PageRequest, paginate
from app.integrations.openfigi.client import OpenFigiClient
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.schemas import ListingDetails, QuoteType
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

# The Yahoo suffix of the issuer's home exchange, by ISIN country prefix.
HOME_EXCHANGES = {
    "US": "",
    "FR": ".PA",
    "NL": ".AS",
    "DE": ".DE",
    "GB": ".L",
    "CH": ".SW",
    "JP": ".T",
    "HK": ".HK",
    "KR": ".KS",
}
# Tried after the home exchange, and first for an ISIN without one (IE and LU funds, KY
# companies).
PREFERRED_EXCHANGES = (".PA", ".AS", ".DE", ".L", "", ".HK")
# The currency of each exchange's main lines, by Yahoo suffix.
MAIN_CURRENCIES = {
    "": "USD",
    ".PA": "EUR",
    ".AS": "EUR",
    ".DE": "EUR",
    ".L": "GBP",
    ".SW": "CHF",
    ".T": "JPY",
    ".HK": "HKD",
    ".KS": "KRW",
}
# Listings of one ISIN checked against Yahoo, at most.
MAX_YAHOO_CHECKS = 5
MAX_ALTERNATIVES = 3


@dataclass(frozen=True)
class IsinMatch:
    # None when no listing Yahoo knows trades in the expected currency; a stored instrument in
    # another currency when none does and the ISIN has one.
    instrument: Instrument | None
    # The other listings' Yahoo symbols, in exchange order.
    alternatives: list[str]


async def get_instrument(session: AsyncSession, instrument_id: uuid.UUID) -> Instrument:
    instrument = await session.get(Instrument, instrument_id)
    if instrument is None:
        raise NotFoundError(f"Instrument {instrument_id} not found.")
    return instrument


async def list_instruments(
    session: AsyncSession, filters: InstrumentFilters, page: PageRequest
) -> KeysetPage[Instrument]:
    """One page of the instruments matching `filters`, newest first."""
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
    return await paginate(session, statement, Instrument, page)


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
    return await _store_listing(session, openfigi, data.yahoo_symbol, details, data.isin)


async def find_instrument_by_isin(
    session: AsyncSession,
    yahoo: YahooClient,
    openfigi: OpenFigiClient,
    isin: str,
    currency: str | None = None,
) -> IsinMatch:
    """The instrument of the ISIN's best listing, stored first if needed.

    Listings are taken in exchange order (`_exchange_rank`). A stored one is used as it is,
    preferably in `currency`. Otherwise, or when none is in `currency`, OpenFIGI's listings are
    checked against Yahoo, and the first Yahoo knows in `currency`, or in its exchange's main
    currency, is stored.
    """
    stored = sorted(
        await _get_by_isin(session, isin), key=lambda i: _exchange_rank(i.yahoo_symbol, isin)
    )
    # Ends the read's transaction, so none stays open while the providers answer.
    await session.commit()
    chosen = next((i for i in stored if currency is None or i.currency == currency), None)
    if chosen is not None:
        others = [i.yahoo_symbol for i in stored if i is not chosen]
        return IsinMatch(instrument=chosen, alternatives=others[:MAX_ALTERNATIVES])

    listings = await openfigi.find_by_isin(isin)
    symbols = sorted(
        (listing.yahoo_symbol for listing in listings), key=lambda s: _exchange_rank(s, isin)
    )
    stored_symbols = {i.yahoo_symbol for i in stored}
    # Stored listings are already known to trade in another currency.
    unchecked = [s for s in symbols if s not in stored_symbols]
    for symbol in unchecked[:MAX_YAHOO_CHECKS]:
        details = await yahoo.get_details(symbol)
        if details is None or details.currency != (currency or MAIN_CURRENCIES[_suffix(symbol)]):
            continue
        instrument, _ = await _store_listing(session, openfigi, symbol, details, isin)
        others = [s for s in symbols if s != symbol]
        return IsinMatch(instrument=instrument, alternatives=others[:MAX_ALTERNATIVES])

    fallback = stored[0] if stored else None
    others = [s for s in symbols if fallback is None or s != fallback.yahoo_symbol]
    return IsinMatch(instrument=fallback, alternatives=others[:MAX_ALTERNATIVES])


async def _store_listing(
    session: AsyncSession,
    openfigi: OpenFigiClient,
    yahoo_symbol: str,
    details: ListingDetails,
    isin: str | None,
) -> tuple[Instrument, bool]:
    """Store the listing Yahoo described; True if this call stored it."""
    share_class_figi = await _share_class_figi(openfigi, yahoo_symbol)

    # Inserts nothing, and returns no row, if another request stored the symbol meanwhile.
    statement = (
        insert(Instrument)
        .values(
            type=INSTRUMENT_TYPES[details.quote_type],
            name=details.name,
            yahoo_symbol=yahoo_symbol,
            exchange_code=details.exchange_code,
            currency=details.currency,
            isin=isin,
            share_class_figi=share_class_figi,
        )
        .on_conflict_do_nothing(index_elements=[Instrument.yahoo_symbol])
        .returning(Instrument)
    )
    created = (await session.scalars(statement)).one_or_none()
    if created is None and isin is not None:
        # The symbol may have been stored without an ISIN, from a search.
        await session.execute(
            update(Instrument)
            .where(Instrument.yahoo_symbol == yahoo_symbol, Instrument.isin.is_(None))
            .values(isin=isin)
        )
    await session.commit()
    if created is None:
        stored = await _get_by_symbol(session, yahoo_symbol)
        if stored is None:
            raise RuntimeError(f"{yahoo_symbol} conflicted on insert but is not stored.")
        return stored, False

    await session.refresh(created)
    return created, True


async def _get_by_isin(session: AsyncSession, isin: str) -> Sequence[Instrument]:
    return (await session.scalars(select(Instrument).where(Instrument.isin == isin))).all()


def _exchange_rank(yahoo_symbol: str, isin: str) -> int:
    """The listing's place in the ISIN's exchange order: its home exchange (from the country
    prefix), then PREFERRED_EXCHANGES, then every other exchange."""
    order = [HOME_EXCHANGES.get(isin[:2]), *PREFERRED_EXCHANGES]
    suffix = _suffix(yahoo_symbol)
    return order.index(suffix) if suffix in order else len(order)


def _suffix(yahoo_symbol: str) -> str:
    """The exchange suffix of a Yahoo symbol: ".PA" for MC.PA, "" for AAPL."""
    _, dot, exchange = yahoo_symbol.rpartition(".")
    return dot + exchange if dot else ""


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
