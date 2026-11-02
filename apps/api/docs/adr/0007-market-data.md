# 7. Market data

- **Status:** accepted
- **Date:** 2026-10-22

## Context

StockNews needs search (by name, symbol or ISIN), listing details and daily prices for stocks
and ETFs on US, European and Asian exchanges. It runs locally, for personal use, at no cost.
A probe of Yahoo Finance through yfinance found search, details and full price history for
every exchange tried, and no throttling on a burst of 25 requests.

## Decision

- **Yahoo Finance through yfinance** (unofficial, free, for personal use).
- **One client, `YahooClient`**, in `integrations/yahoo/`, returning Pydantic models
  (`SearchResult`, `ListingDetails`, `PriceHistory`, `RecentBars`), never yfinance's dicts or
  DataFrames. yfinance's untyped results are checked with a `TypeAdapter` at the boundary.
- **Daily bars with both closes**: history is fetched with `auto_adjust=False`, so a bar has
  Yahoo's `close` (adjusted for splits only) and `adj_close` (also for dividends). Rows missing
  a price are dropped (today's bar is often incomplete), and the splits seen are reported:
  Yahoo adjusts past closes after a split, so stored ones become stale.
- **Prices are `Decimal`**, rounded to 4 places in Yahoo's unit (its prices carry float32
  noise: 417.79998779296875 for 417.8) before the pence factor is applied.
- **Recent bars come from one `history()` call per symbol, run concurrently**, not from
  `yf.download`: that makes one request per symbol too, but swallows each symbol's errors and
  drops the currency that tells pence apart. A symbol Yahoo fails on is reported in `failed`
  with the error's message; the other symbols' bars are still returned.
- **yfinance raises instead of hiding errors** (`yf.config.debug.hide_exceptions = False`), so
  an outage cannot pass for a symbol without data. A 404 means Yahoo does not know the symbol;
  `YFTickerMissingError` means it has no bars in the window. Both are "no data", not failures.
- **Only stocks and ETFs**: search drops other quote types, and `get_details` returns `None`
  for them as for a symbol Yahoo does not know.
- **Pence are converted to pounds**: Yahoo quotes London listings in `GBp` or `GBX`; the
  client reports `GBP` and a `price_factor` of 0.01, which it applies to the prices it returns.
- **yfinance blocks**, so every call runs in a worker thread through `asyncio.to_thread`.
- **Failures are one domain error**: yfinance errors, network errors (`OSError`) and responses
  of the wrong shape become `ProviderUnavailableError`, answered as 503. The cause is logged
  as `yahoo.request_failed`.
- **The client is a FastAPI dependency** (`Yahoo`), so tests can override it.
- **Tests replace yfinance itself** (`monkeypatch.setattr(yf, "Search", ...)`) and never call
  Yahoo. `just yahoo-search QUERY` calls the real Yahoo by hand.

### Stored prices

- **`daily_prices` holds one row per instrument and trading day**, keyed by
  `(instrument_id, date)`: no surrogate id, and the primary key's index serves every read
  (one instrument, a date range, in date order). Prices are `Numeric(18, 6)`: Yahoo's 4
  places, in pence, become 6 in pounds. Deleting an instrument deletes its prices.
- **`backfill(instrument_id)`** fetches the full history and upserts it
  (`ON CONFLICT (instrument_id, date) DO UPDATE`), so running it again stores Yahoo's
  current values, including closes it has revised after a split or dividend. Rows go in
  batches of 1,000, each one `executemany` call, all in one transaction; the read of the
  instrument is committed before Yahoo is called.
- **`GET /instruments/{id}/prices?from=&to=`** returns the bars of a date range, both ends
  included, oldest first. It is not paginated: `to` defaults to today, `from` to one year
  before `to`, and a range longer than five years (1,830 days) is a 422.
- **`update_prices()` keeps followed instruments current**, followed meaning held in any
  position. One with no stored bar is
  backfilled. The others share one `get_recent_bars`
  call over the last 5 days, and their bars are upserted. One with a split in those bars is
  backfilled again, since Yahoo divides every earlier close. It returns, and logs as one
  `prices.update_finished` line, the symbols `backfilled`, `updated` and `failed` (with the
  reason).
- **One symbol failing does not stop the others**: a Yahoo failure or a database error on
  one symbol is rolled back and reported in `failed`. Each instrument is written in its own
  transaction, so one failure undoes nothing else. A symbol with no bar in 5 days (delisted,
  renamed) is reported as failed too, so it gets noticed.
- **It runs as a command**, `python -m app.jobs.update_prices` (`just update-prices`), with
  its own session; there is no endpoint and no scheduler yet.

## Consequences

Yahoo can change or rate-limit its unofficial API at any time; the only defence is the 503
and a quick fix to the client. Each call holds a worker thread for its duration. Yahoo gives
no ISIN, so listings are grouped through OpenFIGI instead ([0006](0006-instruments.md)).

## Alternatives considered

Paid APIs (EODHD, Twelve Data, Alpha Vantage): official and stable, but a cost for a personal
app. Calling Yahoo's HTTP endpoints with an async client (no threads, but reimplements
yfinance's cookie and crumb handling). `yf.download` for recent bars (the caller would have to
pass each symbol's price factor, and an outage would look like every symbol missing). One
multi-row `INSERT … VALUES` per batch instead of `executemany` (about 3 times slower on
12,000 bars: SQLAlchemy compiles each batch's statement anew, and a date appearing twice in
one statement fails `DO UPDATE`). A commit per batch (shorter transactions, but a failure
would leave half a history). Prices
as `float` (binary fractions cannot hold most decimal prices exactly).
