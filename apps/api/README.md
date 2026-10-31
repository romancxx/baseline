# StockNews API

Python backend for StockNews. Requires [uv](https://docs.astral.sh/uv/).

Settings are read from environment variables, then from `.env`. Start from the example:
`cp .env.example .env`, then set `JWT_SECRET` to the output of `openssl rand -hex 32`.
`OPENFIGI_API_KEY` is optional: without it, OpenFIGI allows 25 requests per minute instead
of 250.

Postgres runs in Docker and reads its credentials from the same `.env`. From the repo root,
`just db-up` starts it and waits until it is healthy; `just db-down` stops it and keeps the data.

Run from `apps/api/`:

| Task       | Command                                |
| ---------- | -------------------------------------- |
| Install    | `uv sync`                              |
| Dev server | `uv run uvicorn app.main:app --reload` |
| Lint       | `uv run ruff check`                    |
| Format     | `uv run ruff format`                   |
| Type-check | `uv run pyright`                       |
| Test       | `uv run pytest`                        |

From the repo root, the same commands are available as `just api-install`, `just api-dev`,
`just api-lint`, `just api-format`, `just api-typecheck` and `just api-test`.

`just yahoo-search "MSCI World"` searches the real Yahoo Finance and prints each stock or ETF
found with its exchange code and currency. It is the only command that calls Yahoo; tests
never do.

Tests need Postgres running. Each run recreates a separate `stocknews_test` database, migrates
it to head, and migrates it back to base at the end; the development database is not touched.
Test settings are in `[tool.pytest_env]` in `pyproject.toml`, so tests do not need a `.env`.

## Migrations

Alembic manages the schema. Run from `apps/api/` with Postgres up:

| Task                          | Command                                              |
| ----------------------------- | ---------------------------------------------------- |
| Apply all pending migrations  | `uv run alembic upgrade head`                        |
| Generate a migration          | `uv run alembic revision --autogenerate -m "<what>"` |
| Create an empty migration     | `uv run alembic revision -m "<what>"`                |
| Roll back the last migration  | `uv run alembic downgrade -1`                        |
| Roll back everything          | `uv run alembic downgrade base`                      |
| Show the applied revision     | `uv run alembic current`                             |
| Show the revision chain       | `uv run alembic history`                             |
| Print SQL instead of running  | `uv run alembic upgrade head --sql`                  |

Generated files go to `migrations/versions/` and are linted and formatted by ruff on creation.

## Logging

Logs go to stdout: readable console lines when `ENVIRONMENT=local`, one JSON object per line
otherwise. uvicorn's own logs use the same format, except the reloader's few lines under
`--reload`. Each request is logged once (`http.request`: method, path, status, duration) with a
`request_id`, which is also returned in the `X-Request-ID` response header. A client may send
its own `X-Request-ID` (letters, digits, `.`, `_`, `-`, up to 128 characters) to have it reused.

## Authentication

`POST /api/v1/auth/register` creates an account (JSON `email`, `password` of 12 to 128
characters). `POST /api/v1/auth/login` takes a form (`username` = the email, `password`) and
returns `{"access_token", "token_type": "bearer", "expires_in"}`. Send the token as
`Authorization: Bearer <token>`; it expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (15 by
default). Every endpoint except health, register, login, refresh and logout requires it.

Login also sets a `refresh_token` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`,
`Path=/api/v1/auth`, valid `REFRESH_TOKEN_EXPIRE_DAYS`, 30 by default). When the access token
expires, `POST /api/v1/auth/refresh` with that cookie returns a new access token and replaces
the cookie; each refresh token works once. Sending an already used refresh token logs the
user out everywhere. `POST /api/v1/auth/logout` revokes the cookie's token and clears it.

In `/docs`, click **Authorize**, enter the email and password, and Swagger UI logs in and
sends the token with every request.

## Pagination

List endpoints return one page at a time, newest first:

```json
{ "items": [ ... ], "next_cursor": "eyJjcmVhdGVkX2F0Ijog..." }
```

`limit` sets the page size (default 20, 1 to 100). To get the next page, repeat the request
with the same filters and `cursor=<next_cursor>`. `next_cursor` is `null` on the last page.

## Instrument search

`GET /api/v1/instruments/search?q=<text>` (2 to 100 characters) returns up to 20 stored
instruments, not paginated: an exact ISIN first, then symbols starting with the text, then
names similar to it, tolerating case and small typos (`louis vuiton`). It runs on Postgres's
pg_trgm extension, which the migrations enable.

When fewer than 5 stored instruments match, Yahoo's results are appended, minus those already
stored. They are not saved:

```json
{
  "items": [
    { "source": "local", "id": "0193…", "yahoo_symbol": "AIR.PA", "name": "Airbus SE", … },
    { "source": "yahoo", "yahoo_symbol": "AIR.DE", "name": "Airbus SE", "exchange_code": "GER", "type": "stock" }
  ],
  "yahoo_unavailable": false
}
```

If Yahoo cannot be reached, the stored matches still come back, with `yahoo_unavailable: true`.

To store a Yahoo candidate, `POST /api/v1/instruments/resolve` with
`{"yahoo_symbol": "AIR.DE", "isin": "NL0000235190"}` (`isin` optional; a wrong check digit
answers 422). It answers 201 with
the new instrument, or 200 if the symbol was already stored; 404 if Yahoo does not know it,
503 if Yahoo is down. The share class FIGI is looked up on OpenFIGI; if that fails, the
instrument is stored without one.

## Prices

`GET /api/v1/instruments/{id}/prices?from=2024-01-01&to=2024-12-31` returns the instrument's
daily bars (open, high, low, close, adj_close, volume), oldest first, both dates included.
`to` defaults to today and `from` to one year before `to`; a range longer than 1,830 days
answers 422. Prices are in the instrument's currency, as JSON strings.

The bars come from `just update-prices` (`python -m app.jobs.update_prices`), run by hand
for now. It updates every instrument held in a portfolio or on a watchlist, from the real
Yahoo Finance:

- an instrument without stored prices gets its full history;
- the others get their last 5 days of bars, upserted;
- an instrument with a split in those days gets its full history again, since Yahoo
  adjusts every earlier close.

A symbol that fails does not stop the others. The run ends with one log line,
`prices.update_finished`, listing the symbols `backfilled`, `updated` and `failed` (with
the reason).

## Portfolios

Each user has their own portfolios, managed under `/api/v1/portfolios`: `POST` creates one
(`{"name": "Long term"}`, 201), `GET` lists yours (paginated), and `GET`, `PATCH` (rename)
and `DELETE` act on `/portfolios/{id}`. Names are unique per user (409 otherwise). Another
user's portfolio answers 404, exactly like an id that does not exist.

A portfolio's positions are under `/api/v1/portfolios/{id}/positions`: `POST`
`{"instrument_id": "0193…", "quantity": "10.5", "average_price": "182.25"}` adds one (201;
both numbers optional, positive, up to 8 decimal places), `GET` lists them (paginated), and
`PATCH` and `DELETE` act on `/positions/{position_id}`. Each position comes with its
instrument. Decimals are returned as JSON strings (`"10.50000000"`); send them as strings
too, to keep every digit. `PATCH` changes only the fields sent, and `null` clears one. An
unknown instrument answers 404, an instrument already in the portfolio 409.

## Importing positions

`POST /api/v1/portfolios/{id}/import` takes a CSV file in the multipart field `file` and adds a
position for each row, or updates the one already there. With `?dry_run=true`, it returns the
same report and writes nothing. Each ISIN not stored yet is looked up on OpenFIGI and Yahoo,
which takes a second or more per row (longer without `OPENFIGI_API_KEY`).

### File format

This section is written to be handed to an AI, along with a broker export, to convert it.

- UTF-8 text, at most 64 KiB, comma-separated, with a header row first.
- One row per position: an ISIN appears only once in a file.
- Numbers use a dot as the decimal separator and no thousands separator: `1234.5`, never
  `1,234.50` or `1234,5`. At most 8 decimal places.
- The columns below, in any order. Only `isin` is required; any other column makes the whole
  file rejected.

| Column          | Required                     | Content                                                        |
| --------------- | ---------------------------- | -------------------------------------------------------------- |
| `isin`          | yes                          | The security's 12-character ISIN, e.g. `FR0000121014`.        |
| `quantity`      | no                           | Number of shares or units held, greater than 0.               |
| `average_price` | no                           | Average purchase price per share, greater than 0, in `currency`. |
| `currency`      | when `average_price` is set  | ISO 4217 code of the listing bought: `EUR`, `USD`, `GBP`…     |

`currency` also chooses the listing: the same S&P 500 ETF is CSPX.L in `USD` and CSP1.L in
`GBP`. Without it, the issuer's home exchange is preferred (Paris for an `FR` ISIN), then Paris,
Amsterdam, Xetra, London, the US and Hong Kong. On a position already there, an empty cell
clears that value and a column left out of the file leaves it unchanged.

```csv
isin,quantity,average_price,currency
FR0000121014,10,650.50,EUR
IE00B5BMR087,4.5,512.30,USD
US0378331005,25,,
```

### Report

```json
{
  "dry_run": false,
  "rows": [
    { "line": 2, "isin": "FR0000121014", "status": "imported", "symbol": "MC.PA", "alternatives": ["MOH.DE", "LVMHF"], "message": null }
  ]
}
```

`line` is the row's line in the file (the header is line 1), and `alternatives` lists up to 3
other listings of the ISIN. A bad row does not stop the others.

| Status              | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `imported`          | A position was added.                                                            |
| `updated`           | The portfolio already held this instrument; its position was updated.           |
| `not_found`         | No listing of the ISIN on Yahoo Finance trades in the expected currency.        |
| `invalid`           | The row breaks the format; `message` says how.                                   |
| `currency_mismatch` | The ISIN's stored listing trades in another currency, and no other one trades in the row's. |

A file that breaks the format as a whole (not UTF-8, unknown, missing or repeated columns)
answers 422 with code `invalid_file`; a file over 64 KiB answers 413 (`file_too_large`).

## Watchlist

`/api/v1/watchlist` holds the instruments you follow without necessarily owning them. `GET`
returns all of them at once, newest first, each with its instrument (not paginated).
`POST {"instrument_id": "0193…"}` adds one: 201 the first time, 200 with the existing item if
it is already there. `DELETE /watchlist/{instrument_id}` removes it (204), or answers 404 if it
is not on your watchlist. An unknown instrument answers 404. The price job also updates
watched instruments.

## Project layout

```
alembic.ini        # Alembic config; the database URL comes from Settings
migrations/
├── env.py         # connects Alembic to Settings and Base.metadata
└── versions/      # one file per revision
scripts/           # commands run by hand, such as yahoo_search.py
src/app/
├── main.py        # create_app(): builds the FastAPI app and mounts module routers
├── core/          # app-wide code shared by all modules (settings, database, errors, logging)
├── jobs/          # commands run outside FastAPI, e.g. python -m app.jobs.update_prices
├── integrations/
│   └── <provider>/ # one client per external service: client.py, schemas.py, dependencies.py
└── modules/
    └── <feature>/ # one package per feature
```

Imports go one way: `main` and `jobs` → `modules` → `integrations` → `core`. The `ruff.toml` files in
`core/` and `integrations/` make the other direction a lint error.

Each module contains only the files it needs, from this set:

| File              | Contents                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `router.py`       | The `APIRouter` and its endpoints.                                        |
| `schemas.py`      | Pydantic models: request and response bodies (the module's API contract), and the data it exchanges with jobs and sources. |
| `models.py`       | Database-facing types: table rows as the database stores them.          |
| `service.py`      | Business logic and data access, and the protocols it needs implemented (`NewsSource`). |
| `dependencies.py` | Functions injected with `Depends()` in the router, such as loading a resource or checking access. |

## Code standards

The rules for writing code here are in [CODE_STANDARDS.md](CODE_STANDARDS.md).

## Decisions

Why the API is built the way it is, one record per topic, is in
[docs/adr/](docs/adr/README.md).

## Improvements

Known shortcuts and planned improvements are summarised in
[docs/improvements.md](docs/improvements.md).
