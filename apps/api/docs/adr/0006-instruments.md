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
- **Listings of one security are grouped by `share_class_figi`**, filled from OpenFIGI
  ([0008](0008-security-identifiers.md)).
- **No instrument/listing split yet.** Yahoo returns no ISIN, so there is nothing from Yahoo
  to key a parent security on; OpenFIGI's share class FIGI is the grouping key, and a column
  on each row is enough to group by it. A parent `securities` table can be added later by
  creating one row per distinct `share_class_figi` and pointing each instrument at it.
- **Never entered by users**: `GET /instruments` (paginated, filterable by type,
  `exchange_code`, `symbol_prefix` on `yahoo_symbol` and `share_class_figi`) and
  `GET /instruments/{id}`, behind authentication. Instruments are a shared directory filled
  from the market data provider, so there is no `POST`, `PATCH` or `DELETE` on them; the one
  write is resolving a Yahoo symbol.
- **Resolving a Yahoo symbol**: `POST /instruments/resolve` with `{yahoo_symbol, isin?}`
  returns the stored instrument (200), or stores it from Yahoo's details and returns it (201).
  An unknown symbol is a 404 and Yahoo being down a 503. The share class FIGI comes from
  OpenFIGI but is best-effort: if OpenFIGI fails or has no single match, the instrument is
  stored without one and `instruments.figi_missing` is logged. A given `isin` (from the CSV
  import) is stored with a new instrument.
- **ISINs are checked in full** by the `Isin` alias: the format, then the check digit (Luhn
  over the ISIN with letters read as 10 to 35), so a mistyped ISIN is a 422 before any lookup.
  The database constraint checks the format only.
- **Finding the instrument of an ISIN** (`find_instrument_by_isin`, for the CSV import, with
  an optional currency): a stored instrument with the ISIN is used as it is, preferably one in
  that currency. Otherwise OpenFIGI's listings ([0008](0008-security-identifiers.md)) are
  ordered by exchange: the issuer's home exchange from the ISIN's country prefix (FR → Paris,
  GB → London, …), then a preferred order (Paris, Amsterdam, Xetra, London, US, Hong Kong),
  which is also the whole order for an ISIN without a home exchange (IE and LU funds, KY
  companies). The first 5 are checked against Yahoo in that order, and the first Yahoo knows
  in the given currency, or else in its exchange's main currency, is stored with the ISIN,
  as by resolve. That drops US OTC lines (LVMHF), RMB counters (80700.HK), London
  international lines (0R2V.L) and other currency lines. The other listings' symbols, up to
  3, come back as alternatives.
- **Safe under concurrent resolves**: the insert is `INSERT … ON CONFLICT (yahoo_symbol) DO
  NOTHING RETURNING *`; when it returns no row, another request stored the symbol meanwhile,
  and that row is returned (200). The `SELECT` before it only avoids calling Yahoo for a
  stored symbol; uniqueness rests on the constraint.
- **Local search with pg_trgm**: `GET /instruments/search?q=` (2 to 100 characters) returns
  at most 20 instruments as `{items}`, not paginated. It matches an exact ISIN, a
  `yahoo_symbol` prefix, or a similar name, and ranks them in that order, then by name
  similarity. Names are matched with word similarity (`name %> q`: the query is similar to
  some words of the name), not whole-string similarity (`name % q`): with the defaults,
  `toyota` scores 0.28 against "Toyota Motor Corporation" with `%` (below its 0.3 threshold)
  and 1.0 with `%>`.
- **Yahoo fills thin results**: when fewer than 5 stored instruments match, the search also
  asks Yahoo and appends its results whose `yahoo_symbol` is not stored (checked against the
  table, not only the local results). They are candidates, not saved: each item has a
  `source` (`local` or `yahoo`), and a Yahoo candidate has no id; saving one is a separate,
  explicit step. If Yahoo is unavailable, the local results come back with
  `yahoo_unavailable: true` instead of a 503.
- **Search indexes**: GIN `gin_trgm_ops` on `name` and `yahoo_symbol` (they also serve the
  list's `symbol_prefix` filter) and a btree on `isin`, so each branch of the search's `OR` is
  index-served and Postgres can combine them (`BitmapOr`).
- **Filter values are normalized** (trimmed, uppercased) to match the stored codes; the
  search uppercases the query for the ISIN and symbol matches, and trigrams ignore case.
- **Tests insert instruments directly** through the `make_instrument` factory fixture.

## Consequences

Instruments enter only by resolving a Yahoo symbol, which normalizes codes through the Yahoo
client. A listing resolved while OpenFIGI was unavailable stays ungrouped until a backfill
exists. Crypto, FX and indices are deferred; adding a type needs a
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
- For search: `name % q` with `similarity()` (misses short queries on long names: `toyota`,
  `msci world`, `lvmh`); full-text search with `tsvector` (stems words but tolerates no typos
  and splits symbols badly); an external search engine (one more service for a small table).
- For an ISIN's listing: OpenFIGI's order (US OTC and composite lines often come first);
  checking every candidate against Yahoo at once (faster, but up to dozens of Yahoo calls when
  the first one fits); the currency alone (an ISIN trades in EUR on Paris, Amsterdam and
  Xetra, so the exchange still has to decide).
- For resolving: check-then-insert (two requests can both see no row and both insert);
  catching `IntegrityError` on commit (works, but the failed insert aborts the transaction
  and needs a rollback before the row can be read); `ON CONFLICT DO UPDATE … RETURNING`
  (always returns the row, but rewrites it on every resolve and cannot tell 200 from 201
  without reading Postgres internals such as `xmax`).
- For the Yahoo fallback: asking Yahoo on every search (a Yahoo round trip even when the
  table has the answer); saving Yahoo's results as they are found (fills the table with
  listings nobody picked); a 503 when Yahoo fails (loses the local results the user can still
  use); a separate Yahoo search endpoint (the client would make two calls and merge them).
