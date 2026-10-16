# Improvements

Known shortcuts and gaps, with what they should become and when it becomes worth doing.

| Area | Now | Improvement | Worth doing when |
| --- | --- | --- | --- |
| Tests | The test `DATABASE_URL` in `[tool.pytest_env]` repeats the local Postgres credentials from `.env`. | Let CI or each developer supply it (pytest-env's `D:` prefix keeps an existing value). | Credentials differ between machines, or CI is set up. |
| Database | An unreachable host makes asyncpg wait for its default 60s connect timeout, so `/health` hangs. | Set `connect_args={"timeout": …}` on the engine. | Before deploying. |
| Database | `updated_at` is bumped by SQLAlchemy on ORM updates only; raw SQL updates leave it unchanged. | A `set_updated_at` trigger in the database, created by the migration that adds each table. | The first table is updated outside the ORM. |
| Instruments | `GET /instruments` returns every row. | Pagination (limit and cursor or offset). | The list outgrows one response. |
| Instruments | Any `IntegrityError` on commit is reported as a duplicate (409). | Check the violated constraint (`uq_instruments_symbol_exchange`) and let other integrity errors through. | A second constraint (e.g. a foreign key) is added to the table. |
| Instruments | In `PATCH`, `null` means "leave unchanged" (`exclude_none`). | Use `exclude_unset` so `null` can clear a value. | The table gets a nullable column. |
| Health | `check_database` swallows the error without recording it. | Log the exception when the check fails. | Logging is set up. |
| Lint | Formatting is not checked: `just api-lint` runs only `ruff check`. | Add `ruff format --check` to `api-lint`. | CI is set up. |
| Tests | `PATCH`/`DELETE` on an unknown id (404) and a duplicate via `PATCH` (409) are checked by hand only. | Add a test for each. | Before error handling is centralized. |
