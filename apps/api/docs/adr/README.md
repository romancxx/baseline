# Architecture decision records

One record per topic: what was decided and why. A record is updated when its topic changes;
its date says when it last changed.

| ADR | Topic | Decision |
| --- | --- | --- |
| [0001](0001-project-and-tooling.md) | Project and tooling | uv, `src/` layout, ruff, strict pyright, pytest, a root `justfile` |
| [0002](0002-api-architecture.md) | API architecture | App factory; one package per feature, external services in `integrations/`, shared code in `core/`, one-way imports |
| [0003](0003-api-conventions.md) | API conventions | Settings, domain errors with one error shape, structured logs with request IDs, keyset pagination, decimals as JSON strings, tests on a rolled-back real database |
| [0004](0004-database-and-migrations.md) | Database and migrations | Postgres 18, async SQLAlchemy over asyncpg, a session per request, reviewed Alembic migrations |
| [0005](0005-authentication.md) | Authentication | Argon2id passwords, 15-minute JWTs, rotated refresh tokens in an httpOnly cookie; user-owned rows scoped to the caller, others' answering 404 |
| [0006](0006-instruments.md) | Instruments | One row per Yahoo symbol, grouped by share class FIGI, read-only through the API, searched with pg_trgm |
| [0007](0007-market-data.md) | Market data | Yahoo Finance through yfinance, in worker threads, behind one client returning Pydantic models with `Decimal` prices; daily bars stored per instrument and day, backfilled by upsert |
| [0008](0008-security-identifiers.md) | Security identifiers | OpenFIGI share class FIGIs and ISIN lookups through one rate-limited `httpx2` client per app |
| [0009](0009-portfolios.md) | Portfolios | Several per user, names unique per user, CRUD scoped to the owner; positions of one instrument each, with optional quantity and average price |
| [0010](0010-watchlist.md) | Watchlist | One per user, keyed by `(user_id, instrument_id)`; adding an item already there answers 200; not paginated; watched instruments get prices |
| [0011](0011-news-ingestion.md) | News ingestion (proposed) | Five sources queried once per security; candidate links confirmed by the model; duplicates kept with a canonical copy; trafilatura for text; APScheduler in its own process; Haiku summaries with tone and provenance; daily or weekly digests |

Known gaps and planned work are in [improvements.md](../improvements.md).
