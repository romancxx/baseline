# StockNews API

Python backend for StockNews. Requires [uv](https://docs.astral.sh/uv/).

Settings are read from environment variables, then from `.env`. Start from the example:
`cp .env.example .env`.

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

## Project layout

```
alembic.ini        # Alembic config; the database URL comes from Settings
migrations/
├── env.py         # connects Alembic to Settings and Base.metadata
└── versions/      # one file per revision
src/app/
├── main.py        # create_app(): builds the FastAPI app and mounts module routers
├── core/          # app-wide code shared by all modules (settings, database)
└── modules/
    └── <feature>/ # one package per feature
```

Each module contains only the files it needs, from this set:

| File              | Contents                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `router.py`       | The `APIRouter` and its endpoints.                                        |
| `schemas.py`      | Pydantic models for request and response bodies: the module's API contract. |
| `models.py`       | Database-facing types: table rows as the database stores them.          |
| `service.py`      | Business logic and data access.                                           |
| `dependencies.py` | Functions injected with `Depends()` in the router, such as loading a resource or checking access. |

## Code standards

The rules for writing code here are in [CODE_STANDARDS.md](CODE_STANDARDS.md).

## Improvements

Known shortcuts and planned improvements are tracked in [IMPROVEMENTS.md](IMPROVEMENTS.md).
