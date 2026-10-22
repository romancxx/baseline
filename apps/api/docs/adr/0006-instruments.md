# 6. Instruments

- **Status:** accepted
- **Date:** 2026-10-16

## Decision

- **One row per tradable line**: one Yahoo symbol, on one exchange, in one currency. MC.PA
  and MOH.DE are two rows of the same security.
- **Columns**: type (stock, etf), name, `yahoo_symbol` (unique, e.g. `MC.PA`),
  `exchange_code` (Yahoo's code as returned, e.g. `PAR`, `NMS`), currency (ISO 4217 as
  normalized by the Yahoo client: `GBP`, never `GBp`), `isin` (nullable, not unique, format
  checked in the database), `share_class_figi` (nullable, indexed).
- **Listings of one security are grouped by `share_class_figi`**, filled from OpenFIGI.
- **No instrument/listing split yet.** Yahoo returns no ISIN, so there is nothing from Yahoo
  to key a parent security on; OpenFIGI's share class FIGI is the grouping key, and a column
  on each row is enough to group by it. A parent `securities` table can be added later by
  creating one row per distinct `share_class_figi` and pointing each instrument at it.
- **Read-only through the API**: `GET /instruments` (paginated, filterable by type,
  `exchange_code`, `symbol_prefix` on `yahoo_symbol` and `share_class_figi`) and
  `GET /instruments/{id}`, behind authentication. Instruments are a shared directory filled
  from the market data provider by search and import, not entered by users, so there is no
  `POST`, `PATCH` or `DELETE`.
- **Filter values are normalized** (trimmed, uppercased) to match the stored codes.
- **Tests insert instruments directly** through the `make_instrument` factory fixture.

## Consequences

Until search and import exist, instruments can only be added by SQL or in tests, and the
importer has to normalize codes. Until OpenFIGI is wired in, `share_class_figi` is empty and
listings cannot be grouped. Crypto, FX and indices are deferred; adding a type needs a
hand-written enum migration. `exchange_code` is Yahoo's vocabulary, so another data provider
would need a mapping.

## Alternatives considered

- Separate `securities` and `listings` tables now (nothing to key the parent on until
  OpenFIGI fills it).
- Grouping by ISIN (Yahoo does not return it).
- The ISO 10383 MIC as the exchange (Yahoo returns its own codes; mapping them needs a table
  nobody maintains for us).
- CRUD for every user (lets anyone edit a directory everyone shares); writes restricted to an
  admin role (no roles exist, and nothing needs manual edits yet).
- `VARCHAR` + `CHECK` for the type (easier to extend, weaker in the database).
