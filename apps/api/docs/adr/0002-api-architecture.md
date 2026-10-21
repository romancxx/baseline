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
- **App factory**: `create_app()` builds a fresh app (logging, error handlers, middleware,
  routers under `/api/v1`); the module-level `app` exists only for uvicorn.
- **One-way imports**: `main` → `modules` → `core`. Modules may use each other's service,
  schemas and dependencies, never routers. `core/` importing `modules/` is a lint error.
- **Thin routers, HTTP-free services**: routers parse, call a service, return a schema; services
  take a session and raise domain errors ([0003](0003-api-conventions.md)).
- **`users` owns the `User` entity; `auth` owns the `/auth` endpoints and `get_current_user`**,
  which other modules import ([0005](0005-authentication.md)).

## Consequences

A feature is one new package plus one `include_router` line. Anything that needs a model
(like `get_current_user`) cannot live in `core/`.

## Alternatives considered

Layer layout (`routes/`, `models.py`, `crud.py`): fine when small, scatters features as they
grow.
