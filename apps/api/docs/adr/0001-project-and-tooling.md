# 1. Project and tooling

- **Status:** accepted
- **Date:** 2026-10-14

## Decision

- **uv** manages Python 3.13, the virtualenv and dependencies; `uv.lock` is committed.
- **`src/` layout**, package `app`: tests import the installed package, so packaging mistakes
  fail instead of being hidden by the working directory.
- **ruff** (lint + format, 100 columns), **pyright** strict on `src/`, **pytest**.
- A root **`justfile`** runs everything from the repo root (`api-*`, `db-up`, `db-down`).

## Consequences

Strict pyright needs a commented, single-rule `# pyright: ignore[...]` at partly typed library
boundaries (pydantic-settings, PyJWT).

## Alternatives considered

Poetry or pip (slower, no Python install); flat layout; mypy (slower, less strict by default).
