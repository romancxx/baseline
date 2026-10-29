import asyncio
import datetime as dt
from collections.abc import Callable, Mapping, Sequence
from decimal import Decimal

import pandas as pd
import structlog

# yfinance ships no type hints: its imports and the values it returns are untyped.
import yfinance as yf  # pyright: ignore[reportMissingTypeStubs]
from pydantic import TypeAdapter, ValidationError
from yfinance.exceptions import (  # pyright: ignore[reportMissingTypeStubs]
    YFException,
    YFTickerMissingError,
)

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.schemas import (
    DailyBar,
    ListingDetails,
    PriceHistory,
    QuoteType,
    RecentBars,
    SearchResult,
    Split,
)

logger = structlog.stdlib.get_logger(__name__)

# Make yfinance raise its errors instead of logging them and returning an empty result, so an
# outage cannot pass for a symbol without data.
yf.config.debug.hide_exceptions = False  # pyright: ignore[reportUnknownMemberType]

SEARCH_LIMIT = 10
# Yahoo's codes for prices in pence sterling.
PENCE_CURRENCIES = frozenset({"GBp", "GBX"})
PENCE_FACTOR = Decimal("0.01")
# Yahoo's prices carry float32 noise (417.79998779296875 for 417.8).
PRICE_STEP = Decimal("0.0001")

# Columns of a yfinance price history, in DailyBar's order.
PRICE_COLUMNS = ["Open", "High", "Low", "Close", "Adj Close"]
VOLUME_COLUMN = "Volume"
SPLITS_COLUMN = "Stock Splits"

# Check the shape of yfinance's untyped results.
QUOTES = TypeAdapter(list[dict[str, object]])
INFO = TypeAdapter(dict[str, object])


class YahooClient:
    """Yahoo Finance through yfinance."""

    async def search(self, query: str) -> list[SearchResult]:
        """Stock and ETF listings matching a name, symbol or ISIN."""
        quotes = await _call(_fetch_quotes, query)
        return [result for quote in quotes if (result := _search_result(quote)) is not None]

    async def get_details(self, yahoo_symbol: str) -> ListingDetails | None:
        """The listing's details; None if Yahoo does not know it or it is not a stock or ETF."""
        info = await _call(_fetch_info, yahoo_symbol)
        return _listing_details(yahoo_symbol, info) if info is not None else None

    async def get_history(self, yahoo_symbol: str, start: dt.date | None = None) -> PriceHistory:
        """Daily bars from `start`, or the full history; empty if Yahoo has none."""
        return await _call(_fetch_history, yahoo_symbol, start)

    async def get_recent_bars(self, yahoo_symbols: Sequence[str], days: int = 5) -> RecentBars:
        """The daily bars of the last `days` calendar days, for every symbol at once.

        A symbol Yahoo fails on is reported in `failed`; the others are still returned.
        """
        start = dt.date.today() - dt.timedelta(days=days)
        results = await asyncio.gather(
            *(self._history_or_error(yahoo_symbol, start) for yahoo_symbol in yahoo_symbols)
        )

        # gather returns results in the order of the calls, so zip pairs each symbol with its own.
        by_symbol = dict(zip(yahoo_symbols, results, strict=True))
        fetched = {
            symbol: result
            for symbol, result in by_symbol.items()
            if isinstance(result, PriceHistory)
        }
        return RecentBars(
            histories={symbol: history for symbol, history in fetched.items() if history.bars},
            missing=[symbol for symbol, history in fetched.items() if not history.bars],
            failed={
                symbol: result.message
                for symbol, result in by_symbol.items()
                if isinstance(result, ProviderUnavailableError)
            },
        )

    async def _history_or_error(
        self, yahoo_symbol: str, start: dt.date
    ) -> PriceHistory | ProviderUnavailableError:
        try:
            return await self.get_history(yahoo_symbol, start)
        except ProviderUnavailableError as exc:
            return exc


async def _call[**P, T](fetch: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
    """Run a blocking yfinance call in a worker thread and report its failures as ours."""
    try:
        return await asyncio.to_thread(fetch, *args, **kwargs)
    # OSError covers the network errors of yfinance's HTTP client; ValidationError, a response
    # of the wrong shape.
    except (YFException, OSError, ValidationError) as exc:
        logger.warning("yahoo.request_failed", call=fetch.__name__, error=repr(exc))
        raise ProviderUnavailableError("Yahoo Finance is unavailable. Try again later.") from exc


def _fetch_quotes(query: str) -> list[dict[str, object]]:
    search = yf.Search(query, max_results=SEARCH_LIMIT, news_count=0)
    return QUOTES.validate_python(search.quotes)  # pyright: ignore[reportUnknownMemberType]


def _fetch_info(yahoo_symbol: str) -> dict[str, object] | None:
    """The quote summary, or None if Yahoo does not know the symbol."""
    ticker = yf.Ticker(yahoo_symbol)
    try:
        return INFO.validate_python(ticker.info)  # pyright: ignore[reportUnknownMemberType]
    except OSError as exc:
        if _is_not_found(exc):
            return None
        raise


def _fetch_history(yahoo_symbol: str, start: dt.date | None) -> PriceHistory:
    ticker = yf.Ticker(yahoo_symbol)
    window = {"period": "max"} if start is None else {"start": start}
    try:
        frame = ticker.history(**window, auto_adjust=False)  # pyright: ignore[reportUnknownMemberType]
    except YFTickerMissingError:
        return PriceHistory(bars=[], splits=[])
    except OSError as exc:
        if _is_not_found(exc):
            return PriceHistory(bars=[], splits=[])
        raise

    metadata = INFO.validate_python(ticker.history_metadata)  # pyright: ignore[reportUnknownMemberType]
    currency = _text(metadata, "currency")
    if currency is None:
        raise ProviderUnavailableError("Yahoo Finance returned prices without a currency.")
    _, factor = _currency(currency)

    return PriceHistory(bars=_bars(frame, factor), splits=_splits(frame))


def _is_not_found(exc: OSError) -> bool:
    """Whether yfinance's HTTP client failed with a 404, Yahoo's answer for an unknown symbol."""
    response = getattr(exc, "response", None)
    return getattr(response, "status_code", None) == 404


def _search_result(quote: Mapping[str, object]) -> SearchResult | None:
    yahoo_symbol = _text(quote, "symbol")
    exchange_code = _text(quote, "exchange")
    quote_type = _quote_type(quote)
    if yahoo_symbol is None or exchange_code is None or quote_type is None:
        return None

    return SearchResult(
        yahoo_symbol=yahoo_symbol,
        name=_text(quote, "longname", "shortname") or yahoo_symbol,
        exchange_code=exchange_code,
        quote_type=quote_type,
    )


def _listing_details(yahoo_symbol: str, info: Mapping[str, object]) -> ListingDetails | None:
    exchange_code = _text(info, "exchange")
    yahoo_currency = _text(info, "currency")
    quote_type = _quote_type(info)
    if exchange_code is None or yahoo_currency is None or quote_type is None:
        return None

    currency, price_factor = _currency(yahoo_currency)
    return ListingDetails(
        name=_text(info, "longName", "shortName") or yahoo_symbol,
        exchange_code=exchange_code,
        currency=currency,
        price_factor=price_factor,
        quote_type=quote_type,
    )


def _bars(frame: pd.DataFrame, factor: Decimal) -> list[DailyBar]:
    """The rows that have every price, converted with `factor`."""
    # Drop Nan rows
    complete = frame.dropna(subset=PRICE_COLUMNS)

    return [
        DailyBar(
            date=_trading_day(day),
            open=_price(open_, factor),
            high=_price(high, factor),
            low=_price(low, factor),
            close=_price(close, factor),
            adj_close=_price(adj_close, factor),
            volume=None if pd.isna(volume) else int(volume),
        )
        for day, open_, high, low, close, adj_close, volume in complete[
            [*PRICE_COLUMNS, VOLUME_COLUMN]
        ].itertuples(name=None)
    ]


def _splits(frame: pd.DataFrame) -> list[Split]:
    if SPLITS_COLUMN not in frame.columns:
        return []

    # Only keep the rows that have a split ratio greater than 0
    split_days = frame[frame[SPLITS_COLUMN] > 0]

    return [
        Split(date=_trading_day(day), ratio=Decimal(str(ratio)))
        for day, ratio in split_days[[SPLITS_COLUMN]].itertuples(name=None)
    ]


def _trading_day(day: pd.Timestamp) -> dt.date:
    """The date of a yfinance index entry, a timestamp at midnight in the exchange's time zone."""
    return day.date()


def _price(value: float, factor: Decimal) -> Decimal:
    """A Yahoo price rounded to PRICE_STEP, then converted with `factor`."""
    return Decimal(str(value)).quantize(PRICE_STEP) * factor


def _currency(yahoo_currency: str) -> tuple[str, Decimal]:
    """The ISO 4217 code for Yahoo's currency code, and the factor converting its prices."""
    if yahoo_currency in PENCE_CURRENCIES:
        return "GBP", PENCE_FACTOR
    return yahoo_currency, Decimal(1)


def _quote_type(data: Mapping[str, object]) -> QuoteType | None:
    value = _text(data, "quoteType")
    return QuoteType(value) if value in QuoteType else None


def _text(data: Mapping[str, object], *keys: str) -> str | None:
    """The first of `keys` that holds a non-empty string."""
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    return None
