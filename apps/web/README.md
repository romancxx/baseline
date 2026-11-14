# Baseline

A short brief on the news about each security you hold, beside your portfolio.

Next.js App Router · TypeScript (strict) · Tailwind CSS v4 · Zod · Biome · Vitest · pnpm.

## Getting started

The web app's only backend is `apps/api`.
Set it up with the [API's quickstart](../api/README.md#quickstart), from the repo root, up to `just hooks-install`.

Then set up the web app:

```bash
cd apps/web
pnpm install
cp .env.example .env.local   # API_BASE_URL points at the API on http://localhost:8000
```

From the repo root, `just dev` starts Postgres, applies pending migrations, and serves the API on `http://localhost:8000` and the web app on `http://localhost:3000`; Ctrl-C stops both.
`just web-dev` serves only the web app, against an API already running.

`just hooks-install`, from the repo root, installs the git hooks once per clone; the API's quickstart already runs it.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server (`just web-dev` from the repo root) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` / `pnpm lint:fix` | Biome check (lint + format + import sorting) |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest, unit project only |
| `pnpm verify` | lint + typecheck + test — what CI runs, except the build and the check that `api.types.ts` matches the API's schema |
| `pnpm api:types` | Regenerate `src/shared/api/api.types.ts` from `apps/api/openapi.json` (`just api-openapi`), typing uploaded files as `Blob` |

## Architecture

Folders follow **features**, not file types. A feature owns its whole vertical slice, so
adding one means adding a directory rather than touching six shared ones.

```
src/
  app/                    routes only — each page returns one feature screen
  features/
    auth/                 sign-in, session, requireUser()
    instruments/          listings: search, the instrument header and price chart
    portfolio/            holdings: the overview, Holdings, the position card and its actions
    news/                 briefs and news, and the instrument screen that composes the others
      screens/            one screen per route: loads data, renders components (server)
      components/         React components, in role folders (layout/, form/, list/, …)
      actions/            server actions
      data/               API reads (server-only)
      schemas/            Zod contracts and derived types
      fixtures/           as needed
      index.ts            public API (client-safe)
      server.ts           public API (server-only)
  shared/
    api/                  the API client, its generated types, read and action helpers (server-only)
    config/               the typed environment contract
    ui/                   the theme, the app shell and the design system's primitives
    format.ts             money, quantities and percentages from decimal strings
    session.ts            the session cookies: read, write, refresh, clear (server-only)
  types/                  type declarations, one file per module
  proxy.ts                request ID, session refresh and auth redirect
  instrumentation.ts      validates the server env at boot
```

The rules that keep this shape intact — dependency rules, the client/server split, the full feature directory vocabulary, and checklists for adding a feature or env variable — are in [CODE_STANDARDS.md](CODE_STANDARDS.md).
What each phase decided, and why, is in [docs/adr/](docs/adr/); known gaps and what they should become are in [docs/improvements.md](docs/improvements.md).

## Shell and look

Signed-in pages sit under a top bar ([ADR 0002](docs/adr/0002-visual-foundation-and-shell.md)).
It holds the logo, the two destinations, Home (`/`) and Holdings (`/holdings`), a search button that ⌘K or Ctrl+K also opens, the day of the closes the figures use ("Prices · close of 5 Nov", absent until a holding is priced), and the account menu, which shows the user's email and leads to "Import a CSV" (`/holdings/import`) and "Sign out".
When a page cannot reach the API, it shows "Couldn't reach the server" with "Try again", inside the bar; when the bar itself cannot be filled, without it.
`/portfolio`, Holdings' old path, redirects there permanently.
The app is desktop only.

The canvas is black and the brand is contrast: buttons, the logo and avatars are white or neutral.
Six hues carry meaning and nothing else is coloured: green and red for price movement, always as bare text with its sign first, and azure, amber, slate and violet for news tone, always as a chip with its word and a glyph.
Inter sets the interface, JetBrains Mono the figures, tickers and provenance, Newsreader the brief prose.

## External data

Zod schemas are the single source of truth for anything crossing the app's boundary.
Types are derived with `z.infer`, never hand-written alongside a schema, and the schema validates at the edge: see `auth/schemas/credentials.schema.ts` and its use through `parseForm` in `auth/actions/auth-actions.ts`.
API responses are the exception: they are typed by the generated `api.types.ts` rather than parsed.
Test data is `.parse()`d rather than cast for the same reason: a fixture that drifts from the contract fails loudly.

## Environment

`.env.example` is the checked-in contract; the two config modules define the shapes. The
app parses and validates at boot — `next.config.ts` for builds, `instrumentation.ts` for
the running server — so a misconfigured deployment fails immediately and with a readable
message, rather than surfacing as `undefined` mid-request.

CI copies `.env.example` to `.env`, which means the example file drifting from the schemas
breaks the build. Set `SKIP_ENV_VALIDATION=true` only for builds that legitimately have no
environment yet (e.g. a Docker image built before secrets are attached).
