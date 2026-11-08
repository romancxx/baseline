# 1. Project and tooling

- **Status:** accepted
- **Date:** 2026-10-14

## Decision

- **uv** manages Python 3.13, the virtualenv and dependencies; `uv.lock` is committed.
- **`src/` layout**, package `app`: tests import the installed package, so packaging mistakes
  fail instead of being hidden by the working directory.
- **ruff** (lint + format, 100 columns), **pyright** strict on `src/`, **pytest**.
- **lefthook**, a dev dependency, runs the repository's git hooks: staged Python goes through `ruff check --fix` and `ruff format` on `pre-commit`.
- A root **`justfile`** runs everything from the repo root (`api-*`, `db-up`, `db-down`).
- **GitHub Actions** (`.github/workflows/api.yml`) runs on each push and pull request that touches `apps/api/`: ruff check and format check, pyright and pytest, against a Postgres service container of the version Docker Compose runs.

## Consequences

Strict pyright needs a commented, single-rule `# pyright: ignore[...]` at partly typed library
boundaries (pydantic-settings, PyJWT, yfinance).

## Alternatives considered

Poetry or pip (slower, no Python install); flat layout; mypy (slower, less strict by default).
