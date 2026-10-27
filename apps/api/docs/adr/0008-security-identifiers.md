# 8. Security identifiers

- **Status:** accepted
- **Date:** 2026-10-27

## Context

Yahoo returns no ISIN and nothing that ties MC.PA to MOH.DE. Listings are grouped by share
class FIGI ([0006](0006-instruments.md)), and the CSV import for users starts from ISINs. OpenFIGI (free, run by Bloomberg) maps tickers and ISINs to FIGIs; it never returns ISINs. A share class FIGI is the same on every exchange (MC.PA and MOH.DE share `BBG001S641T5`; the LVMUY ADR has its own).

## Decision

- **`OpenFigiClient` in `integrations/openfigi/`**, async over `httpx2` (the HTTP client the
  project already uses), with `get_share_class_figi(yahoo_symbol)` and `find_by_isin(isin)`.
- **One client per app**: the lifespan in `main.py` creates it, stores it on `app.state` and
  closes it on shutdown, so every request reuses its connection pool and rate limiter.
- **An exchange map** from Yahoo suffix to an ordered list of Bloomberg exchange codes: the
  exchange's own code, then the country composite where the exchange misses listings (Xetra's
  GY has no EUNL; Germany's GR does). Every code of a symbol is sent as one job of a single
  request, and the first code with matches decides. Hong Kong tickers lose Yahoo's leading
  zeros (0700.HK ↔ 700).
- **Strict matching**: a job always carries an exchange code (a bare ticker can match another
  product) and `marketSecDes: Equity`; `get_share_class_figi` returns `None` unless exactly
  one non-null share class FIGI comes back.
- **ISIN lookups keep mapped exchanges only**: rows without a share class FIGI or on an
  exchange outside the map are dropped, and a symbol found under two codes (GY and GR) keeps
  the code tried first.
- **OpenFIGI's limits are respected**: 25 requests per minute and 10 jobs per request without
  a key, 250 and 100 with one (`OPENFIGI_API_KEY`, sent as `X-OPENFIGI-APIKEY`). An
  `aiolimiter` limiter spaces requests; a 429 is retried once after its `Retry-After`.
- **Failures are `ProviderUnavailableError`** (503), as for Yahoo
  ([0007](0007-market-data.md)): network and HTTP errors, a second 429, a job error, or a
  response of the wrong shape.
- **Tests answer HTTP with `httpx2.MockTransport`**, so the client's own requests and parsing
  run against canned OpenFIGI responses.

## Consequences

ISIN candidates are built from Bloomberg's tickers, which are not always Yahoo's (LVMH on SIX
is `LVMH` for Bloomberg, `MC.SW` for Yahoo), and a composite code can point at a listing on
another venue of the country: the import has to check each candidate with Yahoo. Exchanges
outside the map get no FIGI until they are added to it.

## Alternatives considered

respx for mocking (made for `httpx`, not `httpx2`). A hand-written sliding-window limiter
(`aiolimiter` is the common package for it). One request per exchange code (more requests for
the same answer). A client per request (a new connection pool and limiter every time, so the
per-minute limit would not hold).
