# Improvements

Known shortcuts and gaps, with what they should become and when it becomes worth doing.

| Area | Now | Improvement | Worth doing when |
| --- | --- | --- | --- |
| Tests | The test `DATABASE_URL` in `[tool.pytest_env]` repeats the local Postgres credentials from `.env`. | Let CI or each developer supply it (pytest-env's `D:` prefix keeps an existing value). | Credentials differ between machines, or CI is set up. |
| Database | An unreachable host makes asyncpg wait for its default 60s connect timeout, so `/health` hangs. | Set `connect_args={"timeout": …}` on the engine. | Before deploying. |
| Database | `updated_at` is bumped by SQLAlchemy on ORM updates only; raw SQL updates leave it unchanged. | A `set_updated_at` trigger in the database, created by the migration that adds each table. | The first table is updated outside the ORM. |
| Pagination | The keyset query (filters, cursor condition, `limit + 1`) is written in the instruments service. | A generic `paginate()` in `core/pagination.py`. | A second list endpoint is paginated. |
| Pagination | Pages have no total count and no page numbers. | A separate `count` query, or a `total` field computed only when asked for. | The web app needs "page 3 of 12" or a result count. |
| Instruments | `symbol_prefix` cannot use an index: `LIKE 'AA%'` needs a `text_pattern_ops` index (or the `C` collation). | Add `Index(None, "symbol", postgresql_ops={"symbol": "text_pattern_ops"})`. | The table has more than a few thousand rows. |
| Instruments | Any `IntegrityError` on commit is reported as a duplicate (409). | Check the violated constraint (`uq_instruments_symbol_exchange`) and let other integrity errors through. | A second constraint (e.g. a foreign key) is added to the table. |
| Instruments | In `PATCH`, `null` means "leave unchanged" (`exclude_none`). | Use `exclude_unset` so `null` can clear a value. | The table gets a nullable column. |
| Logging | Nothing checks that logs stay free of sensitive data. The request log has the path only (no query string), and no request bodies or headers are logged. | Review every new log field before it ships, and add a structlog processor that redacts known sensitive keys (`password`, `token`, `authorization`, …). | Before auth lands, or before logging query strings, headers or user data. |
| Lint | Formatting is not checked: `just api-lint` runs only `ruff check`. | Add `ruff format --check` to `api-lint`. | CI is set up. |
| Logging | The log level is fixed at `INFO`. | A `LOG_LEVEL` setting. | Someone needs debug logs from a deployed environment. |
| Errors | OpenAPI still documents FastAPI's default 422 body (`HTTPValidationError`) and no 404/409 responses. | Declare `ErrorResponse` in the routes' `responses`. | A client is generated from the OpenAPI schema. |
