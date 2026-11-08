# StockNews

Two apps with separate tooling:

- `apps/api/`: the Python backend (FastAPI, Postgres). Its workflow is in
  [apps/api/CLAUDE.md](apps/api/CLAUDE.md).
- `apps/web/`: the Next.js frontend, to be moved onto `apps/api`.

The root `justfile` runs the API's tasks (`just` lists them). `docker-compose.yml` runs the
API's Postgres: `just db-up`, `just db-down`.

Commits are Conventional Commits scoped by app and topic: `feat(api/news): …`,
`fix(api/import): …`.

Markdown has one sentence per line, never wrapped mid-sentence.
A wrapped paragraph is converted only when it is edited for another reason.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `romancxx/stock-news-v2`, through the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Domain docs

One root `GLOSSARY.md` shared by both apps; ADRs per app in `apps/<app>/docs/adr/`.
See `docs/agents/domain.md`.
