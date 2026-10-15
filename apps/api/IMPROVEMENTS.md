# Improvements

Known shortcuts and gaps, with what they should become and when it becomes worth doing.

| Area | Now | Improvement | Worth doing when |
| --- | --- | --- | --- |
| Tests | Importing `app.core.database` reads `DATABASE_URL`, so `just api-test` fails without a `.env`. | Provide test settings before the app is imported (`conftest.py` or `pytest-env`), or create the engine lazily. | CI is set up. |
| Tests | `/health` is tested with a fake session; nothing runs against a real database. | A test database with one rolled-back transaction per test. The module-level engine needs `NullPool` or a dispose between tests, since each `TestClient` runs its own event loop. | The first model lands. |
| Database | An unreachable host makes asyncpg wait for its default 60s connect timeout, so `/health` hangs. | Set `connect_args={"timeout": …}` on the engine. | Before deploying. |
| Database | `updated_at` is bumped by SQLAlchemy on ORM updates only; raw SQL updates leave it unchanged. | A `set_updated_at` trigger in the database, created by the migration that adds each table. | The first table is updated outside the ORM. |
| Instruments | `GET /instruments` returns every row. | Pagination (limit and cursor or offset). | The list outgrows one response. |
| Instruments | Any `IntegrityError` on commit is reported as a duplicate (409). | Check the violated constraint (`uq_instruments_symbol_exchange`) and let other integrity errors through. | A second constraint (e.g. a foreign key) is added to the table. |
| Instruments | In `PATCH`, `null` means "leave unchanged" (`exclude_none`). | Use `exclude_unset` so `null` can clear a value. | The table gets a nullable column. |
| Health | `check_database` swallows the error without recording it. | Log the exception when the check fails. | Logging is set up. |
| Lint | Formatting is not checked: `just api-lint` runs only `ruff check`. | Add `ruff format --check` to `api-lint`. | CI is set up. |
| Lint | "`core/` never imports from `modules/`" is review-only. | Ban `app.modules` imports with ruff `TID251`, allowed in `main.py` and `modules/`. | A second module lands. |
