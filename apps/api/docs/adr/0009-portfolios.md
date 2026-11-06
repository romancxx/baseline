# 9. Portfolios

- **Status:** accepted
- **Date:** 2026-10-28

## Decision

- **A user has exactly one portfolio**: id, `user_id`, name, timestamps.
  `uq_portfolios_user_id` allows at most one, and registration creates it, named "My portfolio", in the same transaction as the user.
  Deleting a user deletes it (`ON DELETE CASCADE`).
- **The web app shows a single portfolio and never lets the user pick one**, so the API names none: `GET /portfolio` returns the caller's, and nothing creates, renames or deletes one.
  The name is stored but never shown, so there is no rename.
- **The `get_user_portfolio` dependency** (`UserPortfolio`) loads the current user's portfolio by `user_id` ([0005](0005-authentication.md#authorization)); every route under `/portfolio` takes it.
- **The unique constraint's index** serves that lookup and the foreign key's cascade.

### Positions

- **A position is one instrument in one portfolio**: `quantity` and `average_price` (in the
  instrument's currency), both optional and positive when set (`ck_positions_*_positive`),
  `Numeric(18, 8)`. An instrument appears once per portfolio
  (`uq_positions_portfolio_id_instrument_id`).
- **Deleting a portfolio deletes its positions** (`ON DELETE CASCADE`); an instrument held in
  a portfolio cannot be deleted (`ON DELETE RESTRICT`).
- **Under `/portfolio/positions`**, in their own `positions` module: add (201, by `instrument_id`), list (keyset-paginated, newest first), update (`PATCH`), remove (204).
  Each returns the instrument nested.
  An unknown instrument is a 404, a second position of the same one a 409.
- **Scoped to the caller's portfolio**: every endpoint takes `UserPortfolio`, and a position id is looked up within that portfolio only (`OwnedPosition`), so another user's position answers 404 like an unknown id.
- **`PATCH` applies the fields sent**: an omitted field is left unchanged, `null` clears it.

### CSV import

- **`POST /portfolio/import`**, in its own `imports` module: a multipart `UploadFile`, read up to 64 KiB plus one byte, so a larger file is a 413 and never held in memory.
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

A user cannot separate accounts or strategies into portfolios of their own.
Nothing in the database makes a user have a portfolio: one created other than by registration has none, and `/portfolio` answers 500 for them.

### Going back to several portfolios

Positions already belong to a portfolio, not to a user, so no data moves:

1. A revision drops `uq_portfolios_user_id` and brings back a uniqueness rule for names and a `(user_id, created_at, id)` index for the list.
2. The routes take a portfolio id again (`/portfolios/{portfolio_id}/positions`), through a dependency that loads it `WHERE id = :id AND user_id = :me`, so another user's portfolio answers 404.
3. Create, list, rename and delete endpoints come back.

`/portfolio` can stay, as the user's default portfolio, while clients move.

## Alternatives considered

Several portfolios per user, with CRUD under `/portfolios` (endpoints no client calls, and every route takes an id the web app has no way to choose); keeping that API and hiding it in the web app (dead code to maintain and secure); dropping the portfolios table and putting `user_id` on positions (simpler queries, but going back to several would need a data migration); positions as a list of transactions (exact history, but the user must enter every trade; a quantity and an average price are what a broker statement shows); positions inside the portfolios module (one module fewer, but two entities in each file).

For the import: all-or-nothing (one typo would fail a whole broker export); accepting any
delimiter or decimal comma (guessing breaks on `1,234`; a strict format an AI can produce is
simpler); ignoring unknown columns (a misspelt `quantitiy` would silently drop the
quantities); a dry run that writes and rolls back (instruments are committed inside the ISIN
lookup); `ON CONFLICT DO UPDATE` (cannot tell `imported` from `updated` without Postgres
internals).
