# 6. Instruments

- **Status:** accepted
- **Date:** 2026-10-21

## Decision

- **A minimal catalog**: symbol, name, exchange (ISO 10383 MIC), currency (ISO 4217), type
  (stock, etf, index, crypto, fx). Unique on `(symbol, exchange)`.
- **Read-only through the API**: `GET /instruments` (paginated, filterable by type, exchange
  and symbol prefix) and `GET /instruments/{id}`, behind authentication. Instruments are a
  shared directory filled from the market data provider by search and import, not entered by
  users, so there is no `POST`, `PATCH` or `DELETE`.
- **Codes are normalized** (trimmed, uppercased) so `aapl` and `AAPL` cannot both exist. The
  filter schema normalizes its codes the same way.
- **Tests insert instruments directly** through the `make_instrument` factory fixture.

## Consequences

Until search and import exist, instruments can only be added by SQL or in tests. Nothing
normalizes codes on insert anymore: the importer will have to. Adding a type needs a
hand-written enum migration. FX pairs and many crypto venues have no MIC, which the required
`exchange` does not cover yet.

## Alternatives considered

CRUD for every user (lets anyone edit a directory everyone shares); writes restricted to an
admin role (no roles exist, and nothing needs manual edits yet). `VARCHAR` + `CHECK` for the
type (easier to extend, weaker in the database).
