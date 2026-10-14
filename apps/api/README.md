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
