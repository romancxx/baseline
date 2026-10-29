# 9. Portfolios

- **Status:** accepted
- **Date:** 2026-10-28

## Decision

- **A user has any number of portfolios**: id, `user_id`, name (1 to 100 characters, trimmed),
  timestamps. Names are unique per user (`uq_portfolios_user_id_name`); two users can use the
  same one. Deleting a user deletes their portfolios (`ON DELETE CASCADE`).
- **CRUD under `/portfolios`**: create (201), list mine (keyset-paginated, newest first), get,
  rename (`PATCH`), delete (204). A duplicate name on create or rename is a 409.
- **Owned by the current user only** ([0005](0005-authentication.md#authorization)): every
  query is scoped to them, and another user's portfolio answers 404.
- **One index serves the list**: `(user_id, created_at, id)` filters on the user and walks
  the keyset order; it also covers the foreign key for the cascade.

### Positions

- **A position is one instrument in one portfolio**: `quantity` and `average_price` (in the
  instrument's currency), both optional and positive when set (`ck_positions_*_positive`),
  `Numeric(18, 8)`. An instrument appears once per portfolio
  (`uq_positions_portfolio_id_instrument_id`).
- **Deleting a portfolio deletes its positions** (`ON DELETE CASCADE`); an instrument held in
  a portfolio cannot be deleted (`ON DELETE RESTRICT`).
- **Under `/portfolios/{portfolio_id}/positions`**, in their own `positions` module: add
  (201, by `instrument_id`), list (keyset-paginated, newest first), update (`PATCH`), remove
  (204). Each returns the instrument nested. An unknown instrument is a 404, a second position
  of the same one a 409.
- **The portfolio's ownership check guards them**: every endpoint takes `OwnedPortfolio`, so
  another user's portfolio answers 404 before any position is read; a position id is looked up
  within that portfolio only.
- **`PATCH` applies the fields sent**: an omitted field is left unchanged, `null` clears it.

### CSV import

- **`POST /portfolios/{portfolio_id}/import`**, in its own `imports` module: a multipart
  `UploadFile`, read up to 64 KiB plus one byte, so a larger file is a 413 and never held in
  memory.
- **A strict, documented format** (README): UTF-8 (a byte order mark is dropped), commas, a
  header, dot decimals, columns `isin`, `quantity`, `average_price`, `currency`. An unknown,
  missing `isin` or repeated column, or a malformed file, is a 422 `invalid_file` before any
  row is looked up. Rows are validated by the `ImportRow` schema; `average_price` needs
  `currency`, since a price is meaningless without it.
- **Every row is reported**: `imported`, `updated`, `not_found`, `invalid` or
  `currency_mismatch`, with the symbol chosen and up to 3 alternatives. A bad row is reported
  and skipped; an ISIN repeated in the file is `invalid`, so a dry run and a real import give
  the same report.
- **The listing comes from `find_instrument_by_isin`** ([0006](0006-instruments.md)), with
  the row's currency. A stored instrument in another currency, when no listing trades in the
  row's, is a `currency_mismatch`: the position's price is in its instrument's currency.
- **Positions are upserted per row**: `INSERT … ON CONFLICT DO NOTHING RETURNING`, then an
  `UPDATE` of the file's columns when nothing came back, so `imported` and `updated` are told
  apart without reading first. As with `PATCH`, an empty cell clears a value and a column the
  file lacks is left unchanged. Each row commits, so no transaction stays open across the
  next row's provider calls.
- **`dry_run` writes nothing**: instruments are looked up but not stored (an unsaved
  `Instrument` stands in), and an existing position is detected by the listing's symbol.

## Consequences

`user_id` is never part of the API: it is always the caller. A position has no `user_id`: it
is owned through its portfolio. Values and performance are not stored; they will be computed
from quantities, average prices and market data.

## Alternatives considered

One implicit portfolio per user (simpler, but no way to separate accounts or strategies);
names unique ignoring case (stricter; plain uniqueness is enough until users trip on it);
positions as a list of transactions (exact history, but the user must enter every trade;
a quantity and an average price are what a broker statement shows); positions inside the
portfolios module (one module fewer, but two entities in each file).

For the import: all-or-nothing (one typo would fail a whole broker export); accepting any
delimiter or decimal comma (guessing breaks on `1,234`; a strict format an AI can produce is
simpler); ignoring unknown columns (a misspelt `quantitiy` would silently drop the
quantities); a dry run that writes and rolls back (instruments are committed inside the ISIN
lookup); `ON CONFLICT DO UPDATE` (cannot tell `imported` from `updated` without Postgres
internals).
