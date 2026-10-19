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
| Errors | The instruments and users services report any `IntegrityError` on commit as a duplicate (409). A `ck_users_email_lowercase` violation would come back as "email already exists". | Check the violated constraint (`uq_instruments_symbol_exchange`, `uq_users_email`) and let other integrity errors through as 500s. | A table gets a second constraint the API can trip (e.g. a foreign key). |
| Auth | `POST /auth/register` answers 409 for a registered email, so anyone can check whether an address has an account. | Always answer the same way and send a confirmation email instead. | Signup is public. |
| Auth | Nothing limits how often `/auth/register` (and later login) can be called. | Rate limiting per IP and per email. | Before the API is reachable from the internet. |
| Auth | Email addresses are not verified. | Send a confirmation link; mark the user as verified. | Email sending exists. |
| Auth | Argon2 hashing (about 40 ms of CPU) runs on the event loop in register and login, blocking other requests meanwhile. | `await anyio.to_thread.run_sync(hash_password, ...)` / `verify_password`. | Login traffic is concurrent enough to show in latency. |
| Auth | Logout and reuse detection revoke refresh tokens only; an access token already issued stays valid until it expires (up to 15 minutes). | Check a per-user "tokens valid after" timestamp in `get_current_user`, set on logout-everywhere. | Instant revocation matters (e.g. after a password change or a stolen session). |
| Auth | Two refreshes sent at once with the same token (two tabs) look like reuse: the second revokes all of the user's tokens. | A short grace period during which the just-rotated token returns the same new pair. | Users report being logged out when several tabs are open. |
| Auth | Expired and revoked rows stay in `refresh_tokens` forever. | A periodic job deleting rows past `expires_at`. | The table grows noticeably. |
| Auth | A failed refresh (401) leaves the stale cookie in the browser. | Clear the cookie on that 401 too. | The web app relies on the cookie's presence. |
| Auth | There is no password reset. | Emailed single-use reset links, revoking all refresh tokens on reset. | Email sending exists. |
| Instruments | In `PATCH`, `null` means "leave unchanged" (`exclude_none`). | Use `exclude_unset` so `null` can clear a value. | The table gets a nullable column. |
| Logging | Nothing checks that logs stay free of sensitive data. The request log has the path only (no query string), and no request bodies or headers are logged. | Review every new log field before it ships, and add a structlog processor that redacts known sensitive keys (`password`, `token`, `authorization`, …). | Before auth lands, or before logging query strings, headers or user data. |
| Lint | Formatting is not checked: `just api-lint` runs only `ruff check`. | Add `ruff format --check` to `api-lint`. | CI is set up. |
| Logging | The log level is fixed at `INFO`. | A `LOG_LEVEL` setting. | Someone needs debug logs from a deployed environment. |
| Errors | OpenAPI still documents FastAPI's default 422 body (`HTTPValidationError`) and no 404/409 responses. | Declare `ErrorResponse` in the routes' `responses`. | A client is generated from the OpenAPI schema. |
