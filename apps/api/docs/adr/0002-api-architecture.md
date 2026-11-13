# 2. API architecture

- **Status:** accepted
- **Date:** 2026-10-18

## Context

The app grows by feature (instruments, users, news, portfolio), and FastAPI has no module
system to enforce boundaries the way NestJS modules do.

## Decision

- **Feature layout**: `modules/<feature>/` per feature, `core/` for what every feature uses,
  `main.py` to wire them. A module holds only the files it needs from `router.py`,
  `schemas.py`, `models.py`, `service.py`, `dependencies.py`.
- **External services in `integrations/<provider>/`**, not in a module, since several modules
  use them: `client.py` (the client class), `schemas.py` (the Pydantic models it returns),
  `dependencies.py` (the client as a FastAPI dependency). An integration speaks the provider's
  language and knows nothing about our tables ([0007](0007-market-data.md)). A client that
  holds connections is created once in the lifespan, stored on `app.state` and closed on
  shutdown; its dependency reads it from there ([0008](0008-security-identifiers.md)).
- **App factory**: `create_app()` builds a fresh app (logging, error handlers, middleware,
  routers included in one router prefixed with `API_PREFIX`, `/api/v1`); the module-level
  `app` exists only for uvicorn.
- **Jobs run outside FastAPI**: `jobs/<name>.py` is a command (`python -m app.jobs.<name>`)
  that configures logging, opens a session from `session_factory`, builds the clients it
  needs, calls a service function and disposes the engine. It is wiring only, like a router;
  the logic lives in the service, where tests call it with the test session and fakes.
- **One-way imports**: `main` and `jobs` → `modules` → `integrations` → `core`.
  Modules may use each other's service, schemas, models and dependencies, never routers, and two modules never import each other, except `auth` and `users` (below).
  `core/` importing
  `modules/`, `integrations/` or `jobs/`, and `integrations/` importing `modules/` or `jobs/`,
  are lint errors: ruff's
  `banned-api` list is per config file, so each of those two directories has a `ruff.toml`
  that extends `pyproject.toml` with its own bans.
- **Thin routers, HTTP-free services**: routers parse, call a service, return a schema; services
  take a session and raise domain errors ([0003](0003-api-conventions.md)).
- **`users` owns the `User` entity; `auth` owns the `/auth` endpoints and `get_current_user`**,
  which other modules import ([0005](0005-authentication.md)).

## Consequences

A feature is one new package plus one `include_router` line. Anything that needs a model
(like `get_current_user`) cannot live in `core/`.

## Alternatives considered

Layer layout (`routes/`, `models.py`, `crud.py`): fine when small, scatters features as they
grow. A provider client inside the first module that needs it (others would import that
module for it). import-linter for the import rules (one more tool for what ruff covers).
