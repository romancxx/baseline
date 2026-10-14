# StockNews API

Python backend for StockNews. Requires [uv](https://docs.astral.sh/uv/).

Settings are read from environment variables, then from `.env`. Start from the example:
`cp .env.example .env`.

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

## Project layout

```
src/app/
├── main.py        # create_app(): builds the FastAPI app and mounts module routers
├── core/          # app-wide code shared by all modules (settings, ...)
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
