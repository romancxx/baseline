# Architecture decision records

One record per topic: what was decided and why. A record is updated when its topic changes;
its date says when it last changed.

| ADR | Topic | Decision |
| --- | --- | --- |
| [0001](0001-project-and-tooling.md) | Project and tooling | uv, `src/` layout, ruff, strict pyright, pytest, a root `justfile` |
| [0002](0002-api-architecture.md) | API architecture | App factory; one package per feature, external services in `integrations/`, shared code in `core/`, one-way imports |
| [0003](0003-api-conventions.md) | API conventions | Settings, domain errors with one error shape, structured logs with request IDs, keyset pagination, tests on a rolled-back real database |
| [0004](0004-database-and-migrations.md) | Database and migrations | Postgres 18, async SQLAlchemy over asyncpg, a session per request, reviewed Alembic migrations |
| [0005](0005-authentication.md) | Authentication | Argon2id passwords, 15-minute JWTs, rotated refresh tokens in an httpOnly cookie |
| [0006](0006-instruments.md) | Instruments | One row per Yahoo symbol, grouped by share class FIGI, read-only through the API |
| [0007](0007-market-data.md) | Market data | Yahoo Finance through yfinance, in worker threads, behind one client returning Pydantic models with `Decimal` prices |
| [0008](0008-security-identifiers.md) | Security identifiers | OpenFIGI share class FIGIs and ISIN lookups through one rate-limited `httpx2` client per app |

Known gaps and planned work are in [improvements.md](../improvements.md).
