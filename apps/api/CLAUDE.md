# API

Follow the code standards below; reviews check changes against them.

@CODE_STANDARDS.md

## Before a change is done

From the repo root, with Postgres up (`just db-up`), run `just api-format`, `just api-lint`, `just api-typecheck` and `just api-test`.
Run the tests through `just api-test`: a bare `uv run pytest` lacks the test database URL and JWT secret.

- Before trusting a new test, break the behaviour it covers and see it fail.
- Check a new query that relies on indexes with `EXPLAIN`, on a table large enough to make an
  index worth it.
- Add dependencies with `uv add` (`--dev` for tooling); never hand-edit `uv.lock`.

## Adding a module

1. Create `src/app/modules/<name>/` with `__init__.py` and only the files it needs (see
   CODE_STANDARDS §1).
2. In `router.py`: `APIRouter(prefix="/<name>", tags=["<name>"])`, protected unless public on
   purpose.
3. Mount the router in `create_app()`.
4. Add tests using the `conftest.py` fixtures, including the 401 case.

## Adding a table or changing the schema

1. Declare the model in the module's `models.py`: `class Thing(TimestampMixin, Base)`.
2. Import that `models.py` in `migrations/env.py` if it is the module's first model.
3. From `apps/api/`: `uv run alembic revision --autogenerate -m "add things"`.
4. Read the revision and fix it; remove the autogenerate marker comments.
5. `uv run alembic upgrade head`, `uv run alembic downgrade -1`, `uv run alembic upgrade head`.

## Docs

- `README.md`: how to set up and run the API: settings, commands, the endpoint and job tables, and the CSV import format.
  An endpoint or job gets one row there; how it behaves and why goes in its ADR and `/docs`, never repeated in the README.
- `docs/adr/`: one record per topic. A change to how a topic works updates its ADR; a new
  topic gets a new ADR and a row in the index. ADRs record decisions and architecture, never
  progress (no "step N", "built", "done"). Leave an ADR's `Date` line as it is.
- `docs/improvements.md`: a deliberate shortcut gets a row, linked to its ADR.
