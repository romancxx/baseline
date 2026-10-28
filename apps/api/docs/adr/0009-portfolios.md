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
