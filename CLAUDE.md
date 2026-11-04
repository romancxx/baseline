# StockNews

Two apps with separate tooling:

- `apps/api/`: the Python backend (FastAPI, Postgres). Its workflow is in
  [apps/api/CLAUDE.md](apps/api/CLAUDE.md).
- `apps/web/`: the Next.js frontend, to be moved onto `apps/api`.

The root `justfile` runs the API's tasks (`just` lists them). `docker-compose.yml` runs the
API's Postgres: `just db-up`, `just db-down`.

Commits are Conventional Commits scoped by app and topic: `feat(api/news): …`,
`fix(api/import): …`.
