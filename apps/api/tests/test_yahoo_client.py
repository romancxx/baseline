import datetime as dt
from decimal import Decimal
from types import SimpleNamespace

import pandas as pd
import pytest
import yfinance as yf
from yfinance.exceptions import YFRateLimitError, YFTzMissingError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.schemas import (
    DailyBar,
    ListingDetails,
    PriceHistory,
    QuoteType,
    SearchResult,
    Split,
)

pytestmark = pytest.mark.anyio

LVMH_PARIS = {
    "symbol": "MC.PA",
    "longName": "LVMH Moët Hennessy - Louis Vuitton, Société Européenne",
    "shortName": "LVMH",
    "exchange": "PAR",
    "currency": "EUR",
    "quoteType": "EQUITY",
}


class HTTPError(OSError):
    """What yfinance's HTTP client raises when Yahoo answers with an error status."""

    def __init__(self, status_code: int) -> None:
        super().__init__(f"HTTP Error {status_code}")
        self.response = SimpleNamespace(status_code=status_code)


def returned(value: object) -> object:
    """`value`, or raise it if it is an exception."""
    if isinstance(value, Exception):
        raise value
    return value


class FakeTicker:
    """Stands in for `yf.Ticker`: `info` and `history()` return or raise the given values."""

    def __init__(
        self,
        *,
        info: object = None,
        history: object = None,
        currency: str = "USD",
        instrument_type: str = "EQUITY",
    ) -> None:
        self._info = info
        self._history = history
        self.history_metadata = {"currency": currency, "instrumentType": instrument_type}

    @property
    def info(self) -> object:
        return returned(self._info)

    def history(self, **options: object) -> object:
        return returned(self._history)


def fake_search(monkeypatch: pytest.MonkeyPatch, quotes: object) -> None:
    """Make `yf.Search(...).quotes` return `quotes`, or raise it if it is an exception."""
    monkeypatch.setattr(
        yf, "Search", lambda query, **options: SimpleNamespace(quotes=returned(quotes))
    )


def fake_tickers(
    monkeypatch: pytest.MonkeyPatch, tickers: FakeTicker | dict[str, FakeTicker]
) -> None:
    """Make `yf.Ticker(symbol)` return `tickers`, or `tickers[symbol]` for a dict."""
    monkeypatch.setattr(
        yf, "Ticker", lambda symbol: tickers[symbol] if isinstance(tickers, dict) else tickers
    )


def price_frame(*rows: tuple[str, float, float]) -> pd.DataFrame:
    """A yfinance history in Tokyo time: one row per (day, close, split ratio).

    Open, high, low and adjusted close equal the close.
    """
    days = [day for day, _, _ in rows]
    closes = [close for _, close, _ in rows]
    return pd.DataFrame(
        {
            "Open": closes,
            "High": closes,
            "Low": closes,
            "Close": closes,
            "Adj Close": closes,
            "Volume": [1000] * len(rows),
            "Dividends": [0.0] * len(rows),
            "Stock Splits": [ratio for _, _, ratio in rows],
        },
        index=pd.DatetimeIndex(days, tz="Asia/Tokyo", name="Date"),
    )


async def test_search_keeps_only_stocks_and_etfs(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_search(
        monkeypatch,
        [
            {"symbol": "MC.PA", "longname": "LVMH", "exchange": "PAR", "quoteType": "EQUITY"},
            {"symbol": "IWDA.AS", "shortname": "iShares", "exchange": "AMS", "quoteType": "ETF"},
            {"symbol": "^990100-USD-STRD", "exchange": "MSC", "quoteType": "INDEX"},
            {"symbol": "SAAPL=F", "exchange": "CME", "quoteType": "FUTURE"},
        ],
    )

    results = await YahooClient().search("anything")

    assert results == [
        SearchResult(
            yahoo_symbol="MC.PA", name="LVMH", exchange_code="PAR", quote_type=QuoteType.EQUITY
        ),
        SearchResult(
            yahoo_symbol="IWDA.AS", name="iShares", exchange_code="AMS", quote_type=QuoteType.ETF
        ),
    ]


async def test_get_details_returns_the_listing(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_tickers(monkeypatch, FakeTicker(info=LVMH_PARIS))

    details = await YahooClient().get_details("MC.PA")

    assert details == ListingDetails(
        name="LVMH Moët Hennessy - Louis Vuitton, Société Européenne",
        exchange_code="PAR",
        currency="EUR",
        price_factor=Decimal(1),
        quote_type=QuoteType.EQUITY,
    )


@pytest.mark.parametrize("pence", ["GBp", "GBX"])
async def test_get_details_converts_pence_to_pounds(
    monkeypatch: pytest.MonkeyPatch, pence: str
) -> None:
    fake_tickers(monkeypatch, FakeTicker(info=LVMH_PARIS | {"exchange": "LSE", "currency": pence}))

    details = await YahooClient().get_details("AZN.L")

    assert details is not None
    assert (details.currency, details.price_factor) == ("GBP", Decimal("0.01"))


@pytest.mark.parametrize(
    "info",
    [
        HTTPError(404),
        {"trailingPegRatio": None},
        {"symbol": "^GSPC", "exchange": "SNP", "currency": "USD", "quoteType": "INDEX"},
    ],
)
async def test_get_details_of_an_unknown_or_unsupported_symbol_returns_none(
    monkeypatch: pytest.MonkeyPatch, info: object
) -> None:
    fake_tickers(monkeypatch, FakeTicker(info=info))

    assert await YahooClient().get_details("^GSPC") is None


async def test_get_history_returns_bars_on_exchange_dates_without_float_noise(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_tickers(
        monkeypatch, FakeTicker(history=price_frame(("2026-10-20", 417.79998779296875, 0)))
    )

    history = await YahooClient().get_history("0700.HK")

    price = Decimal("417.8")
    assert history == PriceHistory(
        bars=[
            DailyBar(
                date=dt.date(2026, 10, 20),
                open=price,
                high=price,
                low=price,
                close=price,
                adj_close=price,
                volume=1000,
            )
        ],
        splits=[],
    )


async def test_get_history_drops_rows_without_a_close(monkeypatch: pytest.MonkeyPatch) -> None:
    frame = price_frame(("2026-10-19", 3102.0, 0), ("2026-10-20", 3087.0, 0))
    frame.loc[frame.index[-1], "Close"] = float("nan")
    fake_tickers(monkeypatch, FakeTicker(history=frame))

    history = await YahooClient().get_history("7203.T")

    assert [bar.date for bar in history.bars] == [dt.date(2026, 10, 19)]


async def test_get_history_reports_splits(monkeypatch: pytest.MonkeyPatch) -> None:
    frame = price_frame(("2024-06-07", 120.888, 0), ("2024-06-10", 121.79, 10.0))
    fake_tickers(monkeypatch, FakeTicker(history=frame))

    history = await YahooClient().get_history("NVDA")

    assert history.splits == [Split(date=dt.date(2024, 6, 10), ratio=Decimal(10))]


async def test_get_history_converts_pence_to_pounds(monkeypatch: pytest.MonkeyPatch) -> None:
    frame = price_frame(("2026-10-21", 12614.0, 0))
    fake_tickers(monkeypatch, FakeTicker(history=frame, currency="GBp"))

    history = await YahooClient().get_history("AZN.L")

    assert history.bars[0].close == Decimal("126.14")


async def test_get_history_of_an_fx_rate_keeps_seven_significant_digits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # A JPYEUR=X close as Yahoo returned it.
    frame = price_frame(("2026-11-06", 0.005661400035023689, 0))
    fake_tickers(monkeypatch, FakeTicker(history=frame, currency="EUR", instrument_type="CURRENCY"))

    history = await YahooClient().get_history("JPYEUR=X")

    assert history.bars[0].close == Decimal("0.0056614")


@pytest.mark.parametrize("missing", [HTTPError(404), YFTzMissingError("ZZZZNOTREAL")])
async def test_get_history_of_an_unknown_symbol_is_empty(
    monkeypatch: pytest.MonkeyPatch, missing: Exception
) -> None:
    fake_tickers(monkeypatch, FakeTicker(history=missing))

    assert await YahooClient().get_history("ZZZZNOTREAL") == PriceHistory(bars=[], splits=[])


async def test_get_recent_bars_reports_symbols_without_bars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    toyota = FakeTicker(history=price_frame(("2026-10-20", 3087.0, 0)))
    fake_tickers(monkeypatch, {"7203.T": toyota, "ZZZZNOTREAL": FakeTicker(history=HTTPError(404))})

    recent = await YahooClient().get_recent_bars(["7203.T", "ZZZZNOTREAL"])

    assert list(recent.histories) == ["7203.T"]
    assert recent.missing == ["ZZZZNOTREAL"]


async def test_get_recent_bars_reports_symbols_yahoo_fails_on_and_returns_the_others(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    toyota = FakeTicker(history=price_frame(("2026-10-20", 3087.0, 0)))
    fake_tickers(monkeypatch, {"7203.T": toyota, "MC.PA": FakeTicker(history=YFRateLimitError())})

    recent = await YahooClient().get_recent_bars(["7203.T", "MC.PA"])

    assert list(recent.histories) == ["7203.T"]
    assert recent.missing == []
    assert recent.failed == {"MC.PA": "Yahoo Finance is unavailable. Try again later."}


@pytest.mark.parametrize(
    "failure",
    [
        YFRateLimitError(),
        ConnectionError("Failed to connect to query2.finance.yahoo.com"),
        HTTPError(500),
    ],
)
async def test_yahoo_failures_raise_provider_unavailable(
    monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    fake_search(monkeypatch, failure)
    fake_tickers(monkeypatch, FakeTicker(info=failure, history=failure))
    client = YahooClient()

    with pytest.raises(ProviderUnavailableError):
        await client.search("LVMH")
    with pytest.raises(ProviderUnavailableError):
        await client.get_details("MC.PA")
    with pytest.raises(ProviderUnavailableError):
        await client.get_history("MC.PA")
    assert list((await client.get_recent_bars(["MC.PA"])).failed) == ["MC.PA"]


async def test_responses_of_the_wrong_shape_raise_provider_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_search(monkeypatch, "not a list")
    fake_tickers(monkeypatch, FakeTicker(info="not a dict"))
    client = YahooClient()

    with pytest.raises(ProviderUnavailableError):
        await client.search("LVMH")
    with pytest.raises(ProviderUnavailableError):
        await client.get_details("MC.PA")
