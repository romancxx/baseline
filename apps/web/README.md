# StockNews

A daily digest of the news that moved the stocks you actually own.

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
| `pnpm verify` | lint + typecheck + test — what CI runs |
| `pnpm api:types` | Regenerate `src/shared/api/api.types.ts` from `apps/api/openapi.json` (`just api-openapi`) |

## Architecture

Folders follow **features**, not file types. A feature owns its whole vertical slice, so
adding one means adding a directory rather than touching six shared ones.

```
src/
  app/                    routes only — each page returns one feature screen
  features/
    auth/                 sign-in, session, requireUser()
    instruments/          the instrument contract and its avatar
    portfolio/            positions
    news/                 the digest feed
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

## Shell and look

Signed-in pages sit under a top bar ([ADR 0002](docs/adr/0002-visual-foundation-and-shell.md)).
It holds the logo, the two destinations, Home (`/`) and Holdings (`/holdings`), a search button that ⌘K or Ctrl+K also opens, and the account menu, which shows the user's email and leads to "Import a CSV" (`/holdings/import`) and "Sign out".
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

## Conventions

- **Commits** follow the repository's convention (`feat(web/news): …`, see the root `CLAUDE.md`), checked by the root `commit-msg` hook.
- **Pre-commit**: the root hook runs Biome over staged web files only.
  It is a convenience, not a gate; CI runs the full suite.
- **Styling** is Tailwind, restricted to the tokens in `src/shared/ui/theme.css` (one dark
  theme). Changing a colour, type role, radius or spacing role there restyles the whole app;
  components carry no raw values.

## Auth

Signing in and creating an account happen on one screen at `/sign-in`, in two modes: Sign in, and Create account at `/sign-in?mode=create`, each with its own form.
Signing out is in the account menu.
All three go through `apps/api` ([ADR 0001](docs/adr/0001-auth-through-the-api.md)).
Email and password, no confirmation step; a password is 12 to 128 characters, sent exactly as typed.
Next is a backend-for-frontend: the browser talks only to Next, and Next's server calls the API at `API_BASE_URL`.

The API's tokens live in two `HttpOnly` cookies on Next's origin, `sn_access` and `sn_refresh`: `Path=/`, `SameSite=Lax`, and `Secure` when `NEXT_PUBLIC_APP_URL` is https.
The API's own refresh cookie never reaches the browser.
A session lasts up to 30 days; signing out revokes the refresh token at the API and clears the cookies, even when the API cannot be reached.

`src/proxy.ts` runs before every page and server action.
It gives the request a new ID, sent to the API as `X-Request-ID` and logged as `requestId`; an ID sent by the browser is replaced.
It renews an expired access token before rendering, redirects anonymous traffic to `/sign-in` keeping the original path in `?next=`, and sends a signed-in user from `/sign-in` to Home.
Requests renewing the same refresh token at once share one API call, and its new tokens for 30 seconds, so several tabs or prefetches never look like a stolen token; this holds within one Node process.
An API outage during a renewal keeps the session; only the API refusing the refresh token ends it.
Paths are never hand-written — `src/shared/routes.ts` is the single registry, and `PUBLIC_ROUTES` (`/sign-in`, `/session/expired`) is what `proxy.ts` lets through signed out, and `MOVED_ROUTES` maps old paths to where they now live.

Server code that needs a user calls `requireUser()` from `@/features/auth/server`, which reads `GET /users/me` once per request.
It is a second line of defence: `proxy.ts` decides from the cookies alone, and a route it does not match must not silently render as nobody.
When the API refuses the access token while a page renders, the page redirects to `/session/expired`, which clears the cookies and redirects to `/sign-in`.
Authorisation is the API's: it scopes every user-owned resource to the token's user.

The API client in `src/shared/api/` is typed by `api.types.ts`, generated by `pnpm api:types` from the API's committed `openapi.json`.
CI fails when either file drifts from the code that produces it.

## Search

The bar's search button, ⌘K or Ctrl+K, and "Add a security" on Holdings open one modal.
Typing two characters or more searches after a 250 ms pause; a newer query cancels the one in flight, and the previous results stay until the new ones arrive.
Results come in two groups: "In the catalogue", the listings StockNews already stores, and "From the market data provider", listings found on Yahoo and not stored yet.
A listing the user holds carries "In your holdings", with its quantity when it has one.
↑↓ move through both groups, ↵ or a click opens the listing's page, Esc closes.
A provider candidate is stored in the catalogue first; if that fails, the modal stays open and says why.
Nothing is added to the portfolio from search: adding happens on the instrument page.

The browser asks `/search`, a route handler on Next, which calls the API's search and the portfolio overview from the server.

## Holdings

`/holdings` lists every holding in one table: the security, its exchange and type, the quantity and average price, the latest close, the value, the unrealised gain and the weight.
Rows come largest value first, then the holdings that could not be valued.
A value in another currency than the portfolio's base currency (EUR) shows its EUR amount underneath.
A holding without a quantity shows its latest close and "—" elsewhere; a missing price or exchange rate shows "—" too, never zero.
When a price or a rate is missing, a notice says how many holdings are priced, since the totals cover only those.
Quantity and average price are edited in the row; clearing both keeps the security but drops the position.
Removing a holding asks first.
Every figure is the API's, from `GET /portfolio/overview`; the web app does no arithmetic on them.

**Being rebuilt:** `/holdings/import` shows only its heading until it imports positions through the API.

## Home feed

**Being rebuilt:** `/` shows only its heading until it reads briefs and news from the API.
Its components stay for the rebuild.

**Every card says where each part came from**, through its provenance line, and a global disclaimer states that tone is a machine reading at a point in time, not a prediction and not advice.

Cards are polymorphic: `FeedItemSchema` is a discriminated union on `kind` and `FeedCard`
switches on it, so theme cards become a new union member and a renderer rather than a change
to the feed.

## Decisions and shortcuts

Why the architecture looks the way it does — one record per phase, with the measurements that
drove the non-obvious choices — is in [docs/adr/](docs/adr/).

Known gaps and what they should become live in [docs/improvements.md](docs/improvements.md), grouped by feature.

## Notes

- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Both are far cheaper
  to adopt on day one than to retrofit.
- TypeScript is pinned to 5.9 rather than 7.x, which is new enough that the Next
  type plugin and editor tooling haven't fully settled on it.
