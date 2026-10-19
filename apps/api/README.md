# StockNews API

Python backend for StockNews. Requires [uv](https://docs.astral.sh/uv/).

Settings are read from environment variables, then from `.env`. Start from the example:
`cp .env.example .env`, then set `JWT_SECRET` to the output of `openssl rand -hex 32`.

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

## Project layout

```
alembic.ini        # Alembic config; the database URL comes from Settings
migrations/
├── env.py         # connects Alembic to Settings and Base.metadata
└── versions/      # one file per revision
src/app/
├── main.py        # create_app(): builds the FastAPI app and mounts module routers
├── core/          # app-wide code shared by all modules (settings, database, errors, logging)
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
