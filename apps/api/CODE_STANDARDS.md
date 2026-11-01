# Code standards

The rules every change to the API follows. Why the code is shaped this way is in
[docs/adr/](docs/adr/README.md); this file only says what to do. Each rule is tagged with what
holds it in place:

- **[lint]** ruff — fails `just api-lint`.
- **[pyright]** pyright — fails `just api-typecheck`.
- **[test]** A test fails if the rule is broken.
- **[review]** Convention only. Nothing catches it but a reader, so read for it.

Run `just api-format`, `just api-lint`, `just api-typecheck` and `just api-test` before
considering a change done.

---

## 1. Structure — [ADR 0002](docs/adr/0002-api-architecture.md)

- A feature is a package in `src/app/modules/<feature>/`; code every feature uses goes in
  `src/app/core/`. **[review]**
- A client for an external service is a package in `src/app/integrations/<provider>/` with
  `client.py` and `schemas.py`, plus `dependencies.py` when an endpoint uses it. It returns
  its own Pydantic models, never the library's dicts or DataFrames. **[review]**
- A client that holds connections (an `httpx2.AsyncClient`) is created once in the lifespan,
  stored on `app.state` and closed after `yield`; never one per request. A client only
  commands use is created in their `main()` and closed there with `aclose()`. **[review]**
- A module uses only these file names, each only when needed, and each always for the same
  thing: `router.py`, `schemas.py`, `models.py`, `service.py`, `dependencies.py`,
  `sources.py`. No empty files or modules for future features. **[review]**
- Imports are absolute: `from app.modules.health.schemas import HealthResponse`. **[lint]**
- `core/` never imports from `modules/`, `integrations/` or `jobs/`; `integrations/` never
  imports from `modules/` or `jobs/`. **[lint]**
- A command run outside FastAPI is `src/app/jobs/<name>.py`, run with
  `python -m app.jobs.<name>` and a `just` recipe. Only its `if __name__ == "__main__":`
  block configures logging. Its `main()` opens a session with `session_factory()`, builds the
  clients, calls one service function and disposes the engine. Its logic lives in that
  service function. **[review]**
- A job that loops over items catches each item's expected failures
  (`ProviderUnavailableError`, `DBAPIError`), rolls back, records the reason and goes on. It
  never lets one item stop the run. **[test]**
- A module imports another module's `service.py`, `schemas.py` or `dependencies.py`, never its
  `router.py`. **[review]**
- Something a module needs that several implementations can provide (a news source) is a
  `typing.Protocol` in that module's `service.py`. Implementations do not inherit from it;
  one built on an integration's client goes in the module's `sources.py`
  (`GoogleNewsSource`). **[review]**
- Routers are mounted only in `create_app()`, on the `api` router, whose prefix is
  `API_PREFIX` (`/api/v1`). A path the code needs in full is built from `API_PREFIX`, never
  written out. **[review]**

## 2. Routers and endpoints — [ADR 0002](docs/adr/0002-api-architecture.md), [ADR 0003](docs/adr/0003-api-conventions.md)

- A router sets its prefix and tag to the module name:
  `APIRouter(prefix="/instruments", tags=["instruments"])`. A resource nested in another's
  puts the parent's path first: `prefix="/portfolios/{portfolio_id}/positions"`. **[review]**
- A router only reads the request, calls a service or dependency, and returns a schema.
  **[review]**
- The response model is the return annotation (`-> InstrumentRead`); `response_model=` only
  when the returned type differs from the exposed one. **[pyright]**
- Return a schema instance, never a `dict` or an ORM object:
  `InstrumentRead.model_validate(instrument)`. **[pyright]**
- `async def` by default; plain `def` when the endpoint calls blocking code. Never call
  blocking code inside `async def`. **[review]**
- An integration's async method runs each blocking library call with `asyncio.to_thread`.
  **[review]**
- Every endpoint requires a token unless it is public on purpose: protect the router with
  `dependencies=[Depends(get_current_user)]`, or take `user: CurrentUser`. **[test]**
- Declare a fixed path (`/search`) before a path with a parameter (`/{instrument_id}`) in the
  same router. **[test]**
- An upload takes `file: UploadFile` and reads at most its size limit plus one byte
  (`await file.read(MAX_FILE_SIZE + 1)`); the service rejects a longer read with
  `FileTooLargeError` (413) and a malformed file with `InvalidFileError` (422). **[test]**

## 3. Errors — [ADR 0003](docs/adr/0003-api-conventions.md)

- Services fail by raising an `AppError` subclass from `app.core.exceptions`, with a message
  written for the API client. Nothing raises `HTTPException`. **[review]**
- Routers never catch `AppError`. **[review]**
- An integration catches its library's and the network's failures and raises
  `ProviderUnavailableError`; no third-party exception leaves it. **[test]**
- A service catches `ProviderUnavailableError` only when it can still answer without the
  provider, and then says so in the response (`yahoo_unavailable: true`). **[review]**
- A new kind of error gets a `code` and an entry in `STATUS_CODES`. **[review]**
- A case the client must tell apart is a subclass of an existing kind with its own `code`
  (`class InvalidCredentialsError(UnauthorizedError): code = "invalid_credentials"`). Never
  pass a code at the raise site. **[review]**
- Every error response has the `{code, message, details}` shape. **[test]**

## 4. Lists — [ADR 0003](docs/adr/0003-api-conventions.md)

- A list endpoint takes `page: Pagination` and returns `Page[<Entity>Read]`, never a bare
  list. **[review]**
- A short list a user curates by hand, on a table without `id` (the watchlist), is not
  paginated: it returns `<Name>Response` (`items`), newest first. **[review]**
- A time series is not paginated: it takes a capped date range (`dates: PriceRange`) and
  returns `<Entity>sResponse` (`items`), oldest first. **[test]**
- A search with a fixed result limit is not paginated: it takes an `<Entity>Search` model with
  `Depends()` and returns `<Entity>SearchResponse` (`items`), never a bare list. **[review]**
- A service builds the list's `select()` with its filters and returns
  `await paginate(session, statement, Model, page)`; the router returns
  `rows.to_page(<Entity>Read)`. Never write the keyset order, cursor condition or
  `limit + 1` by hand. **[test]**
- A paginated table has an index on `(created_at, id)`, led by the column that scopes the list
  when there is one: `(user_id, created_at, id)`. **[review]**
- Cursors are built and read only by `core/pagination.py`; never parse or construct one by
  hand. **[review]**
- Filters are an `<Entity>Filters` model in `schemas.py`, taken as
  `Annotated[<Entity>Filters, Depends()]`, never `Query()`. Query parameters that resolve
  into one value with defaults (a cursor, a date range) are read with `Query()` by a
  dependency function that raises `RequestValidationError`, like `page_request`. **[test]**
- Prefix filters use `column.startswith(value, autoescape=True)`. **[test]**

## 5. Python and typing — [ADR 0001](docs/adr/0001-project-and-tooling.md)

- Annotate every parameter and return type, tests included (`def test_…() -> None`).
  **[pyright]** in `src/`, **[review]** in `tests/`.
- Never loosen pyright locally. No `Any`, `cast()` or `# pyright: ignore` to silence our own
  code; at a third-party boundary, ignore one named rule and comment why. **[review]**
- Modern syntax: `list[str]`, `X | None`, `collections.abc` types. **[lint]**
- A fixed set of string values is a `StrEnum`. **[review]**
- Money and prices are `Decimal`, never `float`. Build one from a float with
  `Decimal(str(value))`, never `Decimal(value)`. **[review]**
- PEP 8 names: `snake_case` modules, functions and variables; `PascalCase` classes;
  `SCREAMING_SNAKE_CASE` module-level constants. **[review]**
- Separate a function's logical steps (fetch, check, build) with single blank lines.
  **[review]**

## 6. Schemas — [ADR 0002](docs/adr/0002-api-architecture.md), [ADR 0006](docs/adr/0006-instruments.md)

- An entity has `<Entity>Read` (`from_attributes=True`), plus `<Entity>Create` and
  `<Entity>Update` (every field optional) only for the writes the API exposes. Other responses
  are `<Name>Response`. **[review]**
- An update applies `data.model_dump(exclude_unset=True)`, so an omitted field is left
  unchanged and `null` clears a nullable column; `exclude_none=True` only when no updatable
  column is nullable. **[test]**
- A `Decimal` input has `max_digits` and `decimal_places` matching its `Numeric(p, s)`
  column. Read schemas keep `Decimal`, so JSON carries it as a string; never convert to
  `float`. **[review]**
- Normalize input in the schema (whitespace, case). Shared field rules are `Annotated` aliases
  (`Symbol`, `ExchangeCode`, `Email`), reused wherever the field appears. **[review]**
- A list holding several kinds of item is a discriminated union on a `Literal` field:
  `Annotated[A | B, Field(discriminator="source")]`. **[test]**

## 7. Settings — [ADR 0003](docs/adr/0003-api-conventions.md)

- Only values that vary between deployments are settings; the rest are constants in code.
  **[review]**
- Read settings through `get_settings()`, never `os.environ` or a module-level `Settings()`.
  **[review]**
- A new setting goes in `Settings` and in `.env.example`; a required one also in
  `[tool.pytest_env]`. **[review]**
- Keys only Docker Compose reads (`POSTGRES_*`) stay out of `Settings`. **[review]**

## 8. Database — [ADR 0004](docs/adr/0004-database-and-migrations.md)

- Get a session only through `DbSession`; pass it to services as a parameter. Never create an
  engine or session elsewhere. **[review]**
- Database access is async (`AsyncSession`, `await`). **[review]**
- Services commit, then `refresh()` an object before returning it. **[review]**
- Enforce uniqueness with a constraint and catch `IntegrityError` on commit; never `SELECT`
  first to decide whether to insert. **[review]**
- When concurrent requests may insert the same row, insert with
  `postgresql.insert(...).on_conflict_do_nothing(index_elements=[...]).returning(...)`, and
  read the existing row when nothing comes back. A `SELECT` before it may skip work, never
  replace it. **[test]**
- Never build SQL with f-strings or concatenation; bind values. **[review]**
- Models inherit `Base`, use `Mapped[...]` / `mapped_column()`, and `TimestampMixin` when
  mutable, except time series written in bulk (`daily_prices`). A row that is only added
  and removed has `created_at` alone (`watchlist_items`). **[review]**
- Primary keys: `mapped_column(primary_key=True, server_default=func.uuidv7())`. A time
  series or a link between two rows is keyed by what identifies a row instead:
  `(instrument_id, date)`, `(user_id, instrument_id)`, each column `primary_key=True`.
  **[review]**
- An add that may find the row already there, and should succeed anyway, inserts with
  `on_conflict_do_nothing(...).returning(...)` and answers 201 when a row came back, 200
  otherwise (`/instruments/resolve`, `/watchlist`). **[test]**
- Bulk writes go through `session.execute(postgresql.insert(Model).on_conflict_do_update(...),
  rows)` in batches of `BATCH_SIZE`, never one ORM object per row. **[test]**
- Never keep a transaction open while waiting on an external service: read, `commit()`,
  call the service, then write. **[review]**
- Every `datetime` column is `DateTime(timezone=True)`. **[review]**
- Text from an external source with no natural length (URLs, headlines) is `Text`; a value
  with a known length is `String(n)`. **[review]**
- Enum columns: `Enum(PyEnum, name="<snake_case>", values_callable=enum_values)`. **[review]**
- Every `ForeignKey` sets `ondelete`: `"CASCADE"` for a row that belongs to its parent,
  `"RESTRICT"` for a row that only refers to it. Index a foreign key column unless an index
  already starts with it. **[review]**
- A `relationship()` that every read of the model needs is `lazy="joined"`; never rely on
  lazy loading (it fails under `AsyncSession`). **[review]**
- Never name a constraint or index; the naming convention does. A `CheckConstraint` takes a
  short rule name (`name="email_lowercase"`). **[review]**
- Every branch of an `OR` that should use indexes needs its own index; check a new query
  with `EXPLAIN` on a table large enough to make an index worth it. **[review]**
- A Postgres extension is created in the revision that first needs it
  (`CREATE EXTENSION IF NOT EXISTS`) and dropped in its downgrade. **[review]**
- Import every `models.py` in `migrations/env.py`. **[review]**

### 8.1 Migrations

- Change the schema only through Alembic revisions. **[review]**
- Read every autogenerated revision and fix it before applying it; remove the autogenerate
  marker comments. **[review]**
- Run `alembic downgrade -1` then `alembic upgrade head` before committing a revision.
  **[test]** (the test session also runs every downgrade)
- A revision that creates a Postgres enum type drops it in `downgrade()`. **[review]**
- Write enum value changes by hand: `postgresql.ENUM(...).create()` / `.drop()`, and columns
  declared with `postgresql.ENUM(name=..., create_type=False)`. **[review]**
- A revision that deletes rows instead of migrating them says so in its docstring.
  **[review]**
- Never edit a revision once it has run anywhere but your machine. **[review]**

## 9. Security — [ADR 0005](docs/adr/0005-authentication.md)

- Hash and check passwords only with `hash_password` / `verify_password`. **[test]**
- Never store, log, return or echo a plain password. Read schemas never include
  `hashed_password`. **[test]**
- Never strip or otherwise change a password. **[review]**
- Emails go through the `Email` alias. **[test]**
- Create and read access tokens only with `create_access_token` / `decode_access_token`.
  **[review]**
- Login failures raise one `InvalidCredentialsError` and verify against `DUMMY_PASSWORD_HASH`
  when the user is unknown. **[test]**
- Store refresh tokens only as `hash_refresh_token(token)`; send them only in the
  `refresh_token` cookie with the router's fixed flags, never in a body or query string.
  **[test]**
- A refresh token is used once: rotate through `rotate_refresh_token`. **[test]**
- Query a user-owned table only with `user_id` = the current user: in list queries, and for
  one row through the resource's owned dependency (`portfolio: OwnedPortfolio`). Never load
  one by id alone. A row owned through a parent is looked up within the owned parent
  (`position: OwnedPosition`, inside `OwnedPortfolio`). **[test]**
- Another user's row answers 404 with the same message as an unknown id, never 403.
  **[test]**
- A provider's response goes to a parser as a stream (`feedparser.parse(io.BytesIO(content))`),
  never as bytes or a string the library may open as a file path or a URL. **[test]**

## 10. Logging — [ADR 0003](docs/adr/0003-api-conventions.md)

- One logger per module: `logger = structlog.stdlib.get_logger(__name__)`. Never `print()`,
  never `logging.getLogger()`. **[review]**
- Event names are `<area>.<event>` in `snake_case`; variable data goes in fields. **[review]**
- Bind request-wide context with `bind_contextvars`, never by repeating it in each call.
  **[review]**
- Do not catch, log and re-raise; the middleware logs unexpected exceptions once. **[review]**
- Never log a secret, a token, a password or a request body. **[review]**

## 11. Testing — [ADR 0003](docs/adr/0003-api-conventions.md)

- Async tests are marked at module level: `pytestmark = pytest.mark.anyio`. **[test]**
- Use the `conftest.py` fixtures: `client`, `auth_client` for protected endpoints, `user`,
  `other_user`, `make_instrument`, `make_portfolio`, `make_position`, `make_daily_price`,
  `make_watchlist_item`, `yahoo`, `openfigi`, `db_session`, `app`. Never import the module-level `app`. **[review]**
- Give the fakes OpenFIGI listings with `listing(symbol, exchange_code)` and Yahoo details
  with `details(currency)` from `conftest.py`. **[review]**
- A new external client gets a fake in `conftest.py`, installed by the `app` fixture through
  `app.dependency_overrides`, so no endpoint test can reach the provider. **[review]**
- A fake of a `Protocol` (`FakeNewsSource`) lives in `conftest.py`, never in `src/`, and a
  test assigns it to the protocol's type so pyright checks that it matches. **[pyright]**
- Insert the rows a test needs through a `make_<entity>` factory fixture in `conftest.py`, not
  through the API, unless the API call is what the test covers. **[review]**
- A protected endpoint has a test that it answers 401 through plain `client`. **[review]**
- An endpoint on a user-owned resource has a test that `other_user`'s row answers 404 and is
  left unchanged. **[review]**
- Replace our own dependencies with `app.dependency_overrides`, never by patching our modules.
  **[review]**
- Tests never call an external service. An integration's tests replace the library at its
  boundary, never our own functions: `monkeypatch.setattr(yf, "Search", fake)` for a library,
  `httpx2.MockTransport(handler)` passed as the client's `transport` for an HTTP API.
  **[review]**
- A provider that answers with a document (a feed) is tested on real answers, recorded and
  trimmed, in `tests/fixtures/<provider>/`. Each file says in a comment what was recorded,
  when, and what was trimmed. **[review]**
- Override settings with `monkeypatch.setenv` and `get_settings.cache_clear()` before and
  after. **[review]**
- Test settings live in `[tool.pytest_env]`; the test database name ends in `_test`. **[test]**
- Name tests `test_<subject>_<behaviour>`. **[review]**
- Build request bodies with a payload factory in the test module (`user_payload(**overrides)`).
  **[review]**
- Never assert that a database timestamp changed within one test. **[review]**
- Before trusting a new test, break the behaviour it covers and see it fail. **[review]**

## 12. Comments and documentation

- Comments describe the code: what a value is or what a block does. **[review]**
- Comments never argue for an implementation choice; that goes in an ADR or the commit
  message. **[review]**
- Only comment what the code cannot say; if deleting a comment loses nothing, delete it.
  **[review]**
- A change to how a topic works updates its ADR in `docs/adr/` (or adds one for a new topic,
  with a row in the index). **[review]**
- A deliberate shortcut gets a row in `docs/improvements.md`, linked to its ADR. A `TODO` in
  code is not a substitute. **[review]**

## 13. Tooling — [ADR 0001](docs/adr/0001-project-and-tooling.md)

- uv only: `uv add` (`--dev` for tooling); never hand-edit `uv.lock`. **[review]**
- Formatting is ruff's; never hand-format. **[review]**

---

## Checklist: adding a module

1. Create `src/app/modules/<name>/` with `__init__.py` and only the files from §1 it needs.
2. In `router.py`: `APIRouter(prefix="/<name>", tags=["<name>"])`, protected unless public on
   purpose.
3. Mount the router in `create_app()`.
4. Add tests using the `conftest.py` fixtures, including the 401 case.

## Checklist: adding a table

1. Declare the model in the module's `models.py`: `class Thing(TimestampMixin, Base)`.
2. Import that `models.py` in `migrations/env.py` if it is the module's first model.
3. `uv run alembic revision --autogenerate -m "add things"`, then read and fix the file.
4. `uv run alembic upgrade head`, `uv run alembic downgrade -1`, `uv run alembic upgrade head`.
