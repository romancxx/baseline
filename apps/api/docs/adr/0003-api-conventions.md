# 3. API conventions

- **Status:** accepted
- **Date:** 2026-10-19

Cross-cutting choices every module relies on: configuration, errors, logging, pagination and
testing.

## Configuration

- **pydantic-settings**, read once through a cached `get_settings()`, validated at startup.
- **Only values that vary between deployments** are settings (environment, database URL, JWT
  secret, token lifetimes); everything else is a constant in code.
- **Required settings have no default** (`DATABASE_URL`, `JWT_SECRET`), so a missing one fails
  at startup.
- **`.env` is shared with Docker Compose**, so `Settings` ignores keys it does not declare
  (`POSTGRES_*`).

## Errors

- **Services and integrations raise domain errors** from `core/exceptions.py`
  (`NotFoundError`, `ConflictError`, `UnauthorizedError`, `ProviderUnavailableError`), which
  know nothing about HTTP. A case the client must tell apart is a
  subclass with its own `code` (`invalid_credentials`).
- **App-wide handlers** map them to a status and **one body shape, `{code, message, details}`**,
  also used for validation errors, FastAPI's own 404/405, and unhandled 500s. Validation
  details never echo the submitted value.

## Logging

- **structlog over the standard library**: one pipeline for our logs and uvicorn's; console
  output locally, JSON elsewhere.
- **A request middleware** assigns or accepts an `X-Request-ID`, binds it in contextvars so
  every line of the request carries it, logs one `http.request` line, and turns unhandled
  exceptions into a logged 500 with the same header.

## Pagination

- **Keyset, newest first** on `(created_at, id)` with an opaque cursor: the cost of a page does
  not grow with depth, and pages stay correct while rows are inserted. No page numbers or
  total.
- **`Page[T]`** response and a reusable **`Pagination`** dependency (`limit` 1–100, `cursor`);
  filters are a Pydantic model taken with `Depends()`, so OpenAPI lists each one.

## Testing

- **A real Postgres test database**, recreated each session and migrated up and down, so
  migrations are tested too.
- **Every test runs in a transaction that is rolled back**; the code's own commits become
  savepoints.
- **Fixtures** build a fresh app per test with the session dependency overridden: `client`,
  `auth_client`, `user`. Rows a test needs come from factory fixtures (`make_instrument`)
  that insert through the session. Test settings come from `[tool.pytest_env]`.
- **Endpoints never reach a provider in tests**: the `app` fixture overrides each external
  client's dependency with a fake (`yahoo`, a `FakeYahoo`), which a test configures and
  inspects.
- **No external calls**: a third-party library is replaced at its own boundary, so the
  integration's code still runs: with `monkeypatch` for a library such as yfinance, with
  `httpx2.MockTransport` for an HTTP API.

## Alternatives considered

Status codes on the exception classes (HTTP in the domain); plain `logging` with custom
formatters; offset pagination; `metadata.create_all()` in tests (migrations untested);
pytest-asyncio (changing loop-scope configuration).
