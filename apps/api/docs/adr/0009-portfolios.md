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

### Overview

The web app's Home and Holdings show values and gains; the API computes them so the web never does decimal arithmetic.

- **`GET /portfolio/overview`**, in its own `overview` module, takes `UserPortfolio` and returns every position of the caller's portfolio with its figures, and the portfolio's totals.
  It calls no provider: it reads the closes and rates stored by `update_prices` and `update_rates` ([0007](0007-market-data.md)).
- **Per position**: the position (instrument nested), `latest_close` and `latest_close_date` (the latest stored bar), `value` (in the instrument's currency), `value_base`, `unrealised_gain` and `unrealised_gain_pct`, and `weight` (the share of the total `value_base`).
  The amounts need a quantity, and the gain an average price too.
- **A position is valued when it has a `value_base`**: a quantity, a stored close and a rate.
  Otherwise it is listed in `totals.unvalued` with one reason, the first that applies of `no_quantity`, `no_price` and `no_rate`.
  A position without an average price is valued and has no gain.
- **Totals** cover valued positions only: `value_base`, `unrealised_gain_base` and its percentage against the cost, the counts `positions` and `valued_positions`, and `prices_as_of`, the latest close date among them.
  A total no position contributes to is `null`, never zero, so an empty portfolio has no totals.
- **One rate per position converts its amounts into the base currency**: the rate on or before its latest close date, read through `convert` once per currency and date, then multiplied into the value, the gain and the cost.
  The cost is converted at that rate too, so in the base currency the gain shows the price's move, not the currency's since the purchase.
- **Computed with unrounded `Decimal`s, rounded when serialized**: the `Money` and `Percent` aliases round to 2 places, halves up, and never send `-0.00`.
  Percentages are in percent.
  Closes, quantities and average prices are sent as stored.
  Totals are summed before rounding, so they can differ by a cent from the rows, and weights need not add to 100.
- **The latest close of every held instrument comes from one query**, a lateral subquery with `LIMIT 1` read backwards through `daily_prices`' primary key; the rest is one query for the positions and one per currency and date for rates.
- **Not paginated**: totals and weights need every position, and a personal portfolio holds tens.
  A valued position is about 0.7 KB of JSON, so 500 positions make a response of about 360 KB; past that size, positions would be paginated and the totals computed in SQL.

## Consequences

`user_id` is never part of the API: it is always the caller.
A position has no `user_id`: it is owned through its portfolio.
Values and performance are not stored: the overview computes them on each request, from quantities, average prices and stored market data.

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

For the overview: computing values in the web (JavaScript numbers are binary floats, a decimal library in the browser would duplicate the rules, and neither would be tested against the stored data); storing valuations from a job (stale between runs, and one more table to keep current); converting the cost at the purchase's rate (the currency's move since the purchase would show, but positions have no purchase date); paginating the positions (totals and weights need every one anyway); rounding in the service (every later sum would add rounding errors); banker's rounding, Python's default (a half cent going down surprises a reader of money).
