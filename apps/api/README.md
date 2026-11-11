# StockNews API

[![API](https://github.com/romancxx/stock-news-v2/actions/workflows/api.yml/badge.svg)](https://github.com/romancxx/stock-news-v2/actions/workflows/api.yml)

The backend of a news reader for the stocks you hold.
It keeps your portfolio, fetches each stock's daily prices from Yahoo Finance and its headlines from Google News, and has Claude write a short brief per stock that cites the headlines it was written from.

A brief, as stored on 2 November 2026:

> **ASML Holding N.V.** (ASML.AS) · tone: mixed
>
> TIKR.com reports ASML fell 6% in Intel's chip rout, while CEO says supply "will not fully meet the demand."
> marketscreener.com reports Jefferies is Neutral on the company.
> Simply Wall St and Yahoo Finance published pieces on executive pay tied to employee morale and on whether the shares are undervalued or fairly valued after a pullback and a 149% run.
> TradingKey published a piece calling ASML a buy after a Terafab deal.
>
> From 5 articles, 1-2 Nov, generated 2026-11-02 15:10 UTC.
> *Describes news as reported. Not investment advice.*

| Published (UTC) | Publisher          | Headline cited                                                                     |
| --------------- | ------------------ | ---------------------------------------------------------------------------------- |
| 2 Nov, 13:30    | TIKR.com           | ASML Fell 6% in Intel's Chip Rout. Its CEO Says Supply "Will Not Fully Meet the Demand" |
| 2 Nov, 12:20    | marketscreener.com | ASML Holding N.V. : Jefferies is Neutral                                           |
| 1 Nov, 17:08    | Yahoo Finance      | Why Is ASML Holding (NasdaqGS:ASML) Tying Executive Pay To Employee Morale?        |
| 1 Nov, 16:05    | Yahoo Finance      | ASML (NasdaqGS:ASML) Stock Looks Fairly Valued On Its 149% Run                     |
| 1 Nov, 15:24    | TradingKey         | Why ASML is a buy After Terafab Deal?                                              |

## Architecture

```mermaid
flowchart LR
    client([Client]) -->|"HTTP /api/v1"| api[FastAPI app]

    subgraph jobs [Jobs, run with just]
        prices[update_prices]
        ingest[ingest_news]
        briefs[generate_briefs]
    end

    subgraph integrations [integrations/]
        yahoo[Yahoo Finance]
        openfigi[OpenFIGI]
        gnews[Google News RSS]
        llm[Anthropic API or claude CLI]
    end

    api --> db[(Postgres)]
    prices --> db
    ingest --> db
    briefs --> db

    api -->|search, listings| yahoo
    api -->|share classes, ISINs| openfigi
    prices -->|daily bars| yahoo
    ingest -->|headlines| gnews
    briefs -->|briefs| llm
```

## Quickstart

Needs [uv](https://docs.astral.sh/uv/), [just](https://just.systems/), Docker and `jq`.

```sh
git clone https://github.com/romancxx/stock-news-v2.git && cd stock-news-v2
cp apps/api/.env.example apps/api/.env
# In apps/api/.env: set JWT_SECRET to the output of `openssl rand -hex 32`, and either
# ANTHROPIC_API_KEY, or LLM_BACKEND=cli with the `claude` CLI logged in.
just db-up
just api-install
just hooks-install
uv --directory apps/api run alembic upgrade head
just api-dev
```

In a second terminal, register, follow a stock, then fetch its news and write its brief:

```sh
API=http://localhost:8000/api/v1
curl -s $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email": "me@example.com", "password": "correct-horse-battery"}'
TOKEN=$(curl -s $API/auth/login --data-urlencode username=me@example.com \
  --data-urlencode password=correct-horse-battery | jq -r .access_token)
AUTH="Authorization: Bearer $TOKEN"
INSTRUMENT=$(curl -s $API/instruments/resolve -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"yahoo_symbol": "ASML.AS"}' | jq -r .id)
curl -s $API/portfolio/positions -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"instrument_id\": \"$INSTRUMENT\"}"

just ingest-news
just brief
curl -s $API/instruments/$INSTRUMENT/brief -H "$AUTH" | jq
```

The interactive docs are at <http://localhost:8000/docs>.

## Key design decisions

- [0001](docs/adr/0001-project-and-tooling.md): uv, a `src/` layout, ruff, strict pyright and pytest, run through a root `justfile` and GitHub Actions.
- [0002](docs/adr/0002-api-architecture.md): one package per feature, each external service behind its own client in `integrations/`, imports going one way.
- [0003](docs/adr/0003-api-conventions.md): domain errors with one error shape, structured logs with request IDs, keyset pagination, decimals as JSON strings, tests on a real Postgres.
- [0004](docs/adr/0004-database-and-migrations.md): Postgres 18 through async SQLAlchemy, with reviewed Alembic migrations tested up and down.
- [0005](docs/adr/0005-authentication.md): Argon2id passwords, 15-minute JWTs, single-use refresh tokens in an httpOnly cookie; another user's rows answer 404.
- [0006](docs/adr/0006-instruments.md): one instrument per Yahoo symbol, grouped into share classes by FIGI, searched with pg_trgm.
- [0007](docs/adr/0007-market-data.md): Yahoo Finance through yfinance, as `Decimal` prices; daily bars upserted per instrument and day, and daily FX rates into `BASE_CURRENCY`.
- [0008](docs/adr/0008-security-identifiers.md): OpenFIGI for share class FIGIs and ISIN lookups, behind one rate-limited client.
- [0009](docs/adr/0009-portfolios.md): one portfolio per user, created at registration, a CSV import by ISIN with a per-row report and a dry run, and an overview valuing every position.
- [0010](docs/adr/0010-news-ingestion.md): Google News RSS behind a `NewsSource` protocol, and one brief per security, checked in code, citing its headlines.
- [0011](docs/adr/0011-local-llm-backend.md): briefs from the Anthropic API or the local `claude` CLI, chosen by `LLM_BACKEND`.

## Data sources and terms

StockNews is a personal project, meant to be run for your own use.
Each source has its own terms; read them before using the data any other way.

| Source | Used for | Terms |
| --- | --- | --- |
| Yahoo Finance, through [yfinance](https://github.com/ranaroussi/yfinance) | Search, listing details, daily prices | yfinance is not affiliated with Yahoo; its README notes Yahoo's API is meant for personal use only. [Yahoo terms](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html) |
| [OpenFIGI](https://www.openfigi.com/) | Share class FIGIs, ISIN lookups | [OpenFIGI terms of service](https://www.openfigi.com/docs/terms-of-service) |
| Google News RSS | Headlines and links; articles stay on their publishers' sites | [Google terms of service](https://policies.google.com/terms) |
| Anthropic | Writing the briefs | [Commercial terms](https://www.anthropic.com/legal/commercial-terms) with an API key; [consumer terms](https://www.anthropic.com/legal/consumer-terms) with the `claude` CLI on a subscription |

## Disclaimer

StockNews is not affiliated with Yahoo, Google, OpenFIGI or Anthropic.
Briefs are written by a language model from headlines alone: they may be wrong or incomplete, and describe the news as reported.
Nothing here is investment advice.

## Configuration

Settings are read from environment variables, then from `.env`, which starts as a copy of `.env.example`.
`JWT_SECRET` takes the output of `openssl rand -hex 32`.
`OPENFIGI_API_KEY` is optional: without it, OpenFIGI allows 25 requests per minute instead of 250.
Briefs need a model: `ANTHROPIC_API_KEY` for the Anthropic API, or else the `claude` CLI on the PATH, logged in to a Claude subscription.
`LLM_BACKEND` picks one: `api` (the default) or `cli`; set `cli` on your own machine to use the subscription.
Without the chosen backend, news has headlines but no briefs.
`ANTHROPIC_MODEL` picks the model for both (`claude-haiku-5-5` by default).
The API reads only this key, not an `ant auth login` profile; the CLI never sees the key.
`BASE_CURRENCY` is the ISO 4217 code FX rates convert into (`EUR` by default); after changing it, empty the `fx_rates` table and run `just update-prices` again.

Postgres runs in Docker and reads its credentials from the same `.env`. From the repo root,
`just db-up` starts it and waits until it is healthy; `just db-down` stops it and keeps the data.

## Development

From the repo root:

| Task       | Command              |
| ---------- | -------------------- |
| Install    | `just api-install`   |
| Dev server | `just api-dev`       |
| Format     | `just api-format`    |
| Lint       | `just api-lint`      |
| Type-check | `just api-typecheck` |
| Test       | `just api-test`      |
| Schema     | `just api-openapi`   |

`just api-lint` runs `ruff check` and `ruff format --check`.
`just api-openapi` writes the OpenAPI schema to `openapi.json`, committed so the web app's types are generated from it; it needs no database.
GitHub Actions runs lint, the format check, pyright and the tests on each push and pull request that touches `apps/api/`, then fails if `openapi.json` differs from the code's schema.

`just yahoo-search "MSCI World"` searches the real Yahoo Finance and prints each stock or ETF
found with its exchange code and currency. It is the only command that calls Yahoo; tests
never do.

`just news-search "ASML Holding N.V."` searches the real Google News the way ingestion does:
the name without its legal form, finance terms, the last day, junk dropped. It prints the query,
each article (time, publisher, headline) and what was dropped. Tests never call Google News:
they read real feeds, recorded and trimmed, from `tests/fixtures/google_news/`.

Tests need Postgres running.
Each run recreates a separate `stocknews_test` database, migrates it to head, and migrates it back to base at the end; the development database is not touched.
`just api-test` sets the test `DATABASE_URL` and `JWT_SECRET`; CI sets its own.
A test that connects to anything but the local Postgres fails.

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

`POST /api/v1/auth/register` creates an account (JSON `email`, `password` of 12 to 128 characters); an email that already has an account answers 409 with code `email_taken`.
`POST /api/v1/auth/login` takes a form (`username` = the email, `password`) and returns `{"access_token", "token_type": "bearer", "expires_in"}`.
Send the token as `Authorization: Bearer <token>`; it expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (15 by default).
Every endpoint except health, register, login, refresh and logout requires it.

Login also sets a `refresh_token` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`,
`Path=/api/v1/auth`, valid `REFRESH_TOKEN_EXPIRE_DAYS`, 30 by default). When the access token
expires, `POST /api/v1/auth/refresh` with that cookie returns a new access token and replaces
the cookie; each refresh token works once. Sending an already used refresh token logs the
user out everywhere. `POST /api/v1/auth/logout` revokes the cookie's token and clears it.

In `/docs`, click **Authorize**, enter the email and password, and Swagger UI logs in and
sends the token with every request.

## Pagination

List endpoints return one page at a time, newest first (news by publication time, the rest
by creation time):

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
for now. It updates every instrument held in a portfolio, from the real Yahoo Finance:

- an instrument without stored prices gets its full history;
- the others get their last 5 days of bars, upserted;
- an instrument with a split in those days gets its full history again, since Yahoo
  adjusts every earlier close.

A symbol that fails does not stop the others. The run ends with one log line,
`prices.update_finished`, listing the symbols `backfilled`, `updated` and `failed` (with
the reason).

The same command then stores the last 5 days of FX rates of every currency held, other than `BASE_CURRENCY`, from Yahoo's FX symbols (`USDEUR=X`: euros per US dollar).
It logs `rates.update_finished`, listing the currencies `updated` and `failed`.
Rates start from the first run: there is no longer history.

## Portfolios

Each user has one portfolio, created when they register.
`GET /api/v1/portfolio` returns yours.

Its positions are under `/api/v1/portfolio/positions`: `POST` `{"instrument_id": "0193…", "quantity": "10.5", "average_price": "182.25"}` adds one (201; both numbers optional, positive, up to 8 decimal places), `GET` lists them (paginated), and `PATCH` and `DELETE` act on `/portfolio/positions/{position_id}`.
Each position comes with its instrument.
Decimals are returned as JSON strings (`"10.50000000"`); send them as strings too, to keep every digit.
`PATCH` changes only the fields sent, and `null` clears one.
An unknown instrument answers 404, an instrument already in the portfolio 409.
Another user's position answers 404, exactly like an id that does not exist.

### Overview

`GET /api/v1/portfolio/overview` returns every position of your portfolio valued at its latest stored close, and the portfolio's totals in `BASE_CURRENCY`.
It calls no provider: it uses the prices and rates `just update-prices` stored.

Each item of `positions` has the position (instrument nested), `latest_close` and `latest_close_date`, `value` (in the instrument's currency), `value_base`, `unrealised_gain` and `unrealised_gain_pct`, and `weight` (its share of the total `value_base`).
Valued positions come first, largest first, then the others.
`totals` has `base_currency`, `value_base`, `unrealised_gain_base` and `unrealised_gain_base_pct`, the counts `positions` and `valued_positions`, `prices_as_of` (the latest close date used), and `unvalued`: each position without a `value_base`, with its `reason`, `no_quantity`, `no_price` or `no_rate`.
Totals cover valued positions only.

Computed figures are strings rounded to 2 places, halves up; percentages are in percent (`"1.91"` is 1.91 %).
A figure that cannot be computed is `null`, never `"0.00"`.
Amounts in the base currency use the rate of each position's latest close day, so the gain there leaves out the currency's move since the purchase.

## Importing positions

`POST /api/v1/portfolio/import` takes a CSV file in the multipart field `file` and adds a position to your portfolio for each row, or updates the one already there.
With `?dry_run=true`, it returns the same report and writes nothing.
Each ISIN not stored yet is looked up on OpenFIGI and Yahoo, which takes a second or more per row (longer without `OPENFIGI_API_KEY`).

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

## News

`just ingest-news` (`python -m app.jobs.ingest_news`), run by hand, stores the last day's
Google News headlines of every stock held in a portfolio. ETFs get none.

- Listings of one share class (MC.PA and MOH.DE) are searched once, under the name of the
  first one stored, and each article is linked to all of them.
- An article already stored under the same URL, or under the same headline published within 3
  days, is not stored again; it gets the new links. Running the command twice in a row adds
  nothing.
- Articles published more than 30 days ago are deleted at the end of the run.

A query that fails does not stop the others. The run ends with one log line,
`news.ingest_finished`: the followed stocks (`instruments`), the `queries` sent, the articles
`fetched`, what the source `dropped` by reason, the `new` articles and links (`linked`), the
articles `deleted`, and the queries that `failed` (with the reason).

`just brief` (`python -m app.jobs.generate_briefs`) then writes a brief, with the real
Anthropic API, for each security that has articles published after the newest headline of
its latest brief. It sends the security's name and its 40 most recent headlines of the last 3
days, and stores the brief (1 to 5 sentences, a tone, the headlines it cites) with the model,
the prompt version and the tokens it cost. When no headline bears on the business, the model
writes nothing and no brief is stored (`no_news`). A brief that fails a check (unknown
citations, length, advice) is asked for once more with the reason; failing again, it is
logged and not stored; each rejected draft is logged as `briefs.draft_rejected`, with its
text and the reason. Without a backend, the command does nothing. It ends with one
log line, `briefs.run_finished`.

Both read endpoints take any listing of a share class, followed or not: MOH.DE answers with
what was fetched for MC.PA.

- `GET /api/v1/instruments/{id}/news` returns its articles (`title`, `publisher`,
  `published_at`, `url`), newest published first, paginated like the other lists.
- `GET /api/v1/instruments/{id}/brief` returns its latest brief, or 404 when there is none:

```json
{
  "text": "Reuters reports LVMH's third-quarter sales rose 4%…",
  "tone": "positive",
  "model": "api:claude-haiku-5-5",
  "articles": [{ "title": "LVMH sales rise - Reuters", "publisher": "Reuters", … }],
  "provenance": "From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC",
  "disclaimer": "Describes news as reported. Not investment advice.",
  …
}
```

`articles` are the ones the brief cites. The provenance line counts them, and gives the days
of the headlines it was written from (UTC) and when it was generated.

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
| `sources.py`      | Implementations of those protocols over an integration's client (`GoogleNewsSource`). |
| `dependencies.py` | Functions injected with `Depends()` in the router, such as loading a resource or checking access. |

## Code standards

The rules for writing code here are in [CODE_STANDARDS.md](CODE_STANDARDS.md).

## Decisions

Why the API is built the way it is, one record per topic, is in
[docs/adr/](docs/adr/README.md).

## Improvements

Known shortcuts and planned improvements are summarised in
[docs/improvements.md](docs/improvements.md).

## License

MIT, see [LICENSE](../../LICENSE).
