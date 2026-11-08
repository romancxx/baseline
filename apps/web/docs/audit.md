# apps/web audit

- **Date:** 2026-11-06, at commit `da69411` (`feat(api/brief): brief list endpoints`)
- **Purpose:** the starting point for turning `apps/web` into a frontend for `apps/api`. It
  describes what exists and what each part becomes. It decides nothing.
- **Scope:** all of `apps/web` (code, config, docs, migrations, tests, workflows); `apps/api`'s
  README, ADRs and OpenAPI schema.

Paths are relative to `apps/web/` unless they start with `apps/api/`. "Not found" means the
item was searched for and is not in the repository.

**What was run**

| Command                                     | Where      | Result                                                                                          |
| ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `pnpm lint`                                 | `apps/web` | clean, 131 files                                                                                |
| `pnpm typecheck`                            | `apps/web` | clean                                                                                           |
| `pnpm test`                                 | `apps/web` | 17 files, 112 tests, all pass                                                                   |
| `pnpm build`                                | `apps/web` | succeeds, with one warning: the `middleware` file convention is deprecated in favour of `proxy` |
| `uv run python -c "create_app().openapi()"` | `apps/api` | the OpenAPI schema, built from the app factory without starting a server                        |

Not run: `pnpm test:db` and `pnpm dev`. Both need the local Supabase stack (`pnpm db:start`),
which was not started.

---

## 1. Stack

| Area            | What is used                                                                                                                                                                             | Where                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Framework       | Next.js 16.3.2, App Router, `typedRoutes`, `reactStrictMode`                                                                                                                             | `next.config.ts`                                       |
| React           | 19.2.8                                                                                                                                                                                   | `package.json`                                         |
| Language        | TypeScript 5.9.3, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`                                                                         | `tsconfig.json`                                        |
| Styling         | Tailwind CSS 4.3.3 through `@tailwindcss/postcss`, with Tailwind's defaults reset to the tokens in `theme.css`; `clsx` and `tailwind-merge` behind `cn()`                                | `src/shared/ui/theme.css`, `src/shared/ui/cn.ts`       |
| UI libraries    | `lucide-react` for icons, `next/font` Inter. No component library (no Radix, no shadcn)                                                                                                  | `src/shared/ui/display/icon.tsx`, `src/app/layout.tsx` |
| Data fetching   | Server Components call the Supabase server client from each feature's `data/`                                                                                                            | `src/features/*/data/`                                 |
| Mutations       | Server actions followed by `revalidatePath`                                                                                                                                              | `src/features/*/actions/`                              |
| Client state    | `useState` and `useActionState` only. No React Query, SWR or store                                                                                                                       | —                                                      |
| Forms           | Native `<form action>` with `useActionState`, validated with Zod through `parseForm`. No form library                                                                                    | `src/shared/form-state.ts`                             |
| Validation      | Zod 4.4.3 at every boundary                                                                                                                                                              | `src/features/*/schemas/`                              |
| Charts          | Not found                                                                                                                                                                                | —                                                      |
| Auth            | Supabase Auth over cookies (`@supabase/ssr`), refreshed in `middleware.ts`                                                                                                               | `src/shared/supabase/`, `src/middleware.ts`            |
| Testing         | Vitest 4.1.11 in two projects: `unit` (jsdom, Testing Library, jest-dom) and `db` (node, against a local Supabase). Coverage through v8. No end-to-end tests (no Playwright, no Cypress) | `vitest.config.ts`, `tests/db/`                        |
| Lint and format | Biome 2.5.10: lint, format, import sorting, and import boundaries through `noRestrictedImports`                                                                                          | `biome.jsonc`                                          |
| Commits         | commitlint with a closed scope list; husky runs lint-staged on pre-commit                                                                                                                | `commitlint.config.js`, `.husky/`                      |
| Package manager | pnpm 10.13.1 (`packageManager`); Node 22.11.0 from `.node-version`                                                                                                                       | `package.json`, `.node-version`                        |

### Scripts

| Script                                                                      | What it does                   | Fate                                                 |
| --------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `dev`, `build`, `start`                                                     | Next                           | keep                                                 |
| `typecheck`                                                                 | `next typegen && tsc --noEmit` | keep                                                 |
| `lint`, `lint:fix`, `format`                                                | Biome                          | keep                                                 |
| `test`, `test:watch`, `test:coverage`                                       | Vitest, `unit` project         | keep                                                 |
| `verify`                                                                    | lint, typecheck, test          | keep                                                 |
| `db:start`, `db:stop`, `db:reset`, `db:push`, `db:types`, `db:types:linked` | Supabase CLI                   | drop                                                 |
| `db:seed`, `db:seed:instruments`, `db:seed:feeds`                           | Upsert the seed JSON files     | drop                                                 |
| `ingest`, `summarize`                                                       | Batch pipelines                | drop (the API's `just ingest-news` and `just brief`) |
| `test:db`                                                                   | Vitest, `db` project           | drop                                                 |
| `prepare`                                                                   | husky                          | keep                                                 |

### Environment variables

The schemas are in `src/shared/config/env.ts` (public) and `src/shared/config/server-env.ts`
(server). Both are validated at build time (`next.config.ts`) and at server start
(`src/instrumentation.ts`).

| Variable                                                                                                                          | Used by                                                                                       | Fate                           |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_APP_URL`                                                                                                             | `metadataBase` in `src/app/layout.tsx`                                                        | keep                           |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                | every Supabase client                                                                         | drop                           |
| `SUPABASE_SECRET_KEY`                                                                                                             | admin client (pipelines, seeds)                                                               | drop                           |
| `FINNHUB_API_KEY`, `FINNHUB_BASE_URL`                                                                                             | ingestion                                                                                     | drop                           |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `NEAR_DUPLICATE_DISTANCE`, `INGEST_LOOKBACK_DAYS`                                      | ingestion                                                                                     | drop                           |
| `SUMMARY_BACKEND`, `ANTHROPIC_API_KEY`, `SUMMARY_PRICE_*`, `MAX_SUMMARIES_PER_RUN`, `SUMMARY_CONCURRENCY`, `MIN_MATCH_CONFIDENCE` | summarisation                                                                                 | drop                           |
| `SUMMARY_MODEL`, `SUMMARY_PROMPT_VERSION`                                                                                         | summarisation, and also the home feed (`news/data/feed-queries.ts` filters summaries by them) | drop                           |
| `LOG_LEVEL`                                                                                                                       | `src/shared/logger.ts`                                                                        | keep if server code still logs |
| `NODE_ENV`                                                                                                                        | server schema                                                                                 | keep                           |
| API base URL                                                                                                                      | —                                                                                             | **new**, not found today       |

`server-env.ts` requires `ANTHROPIC_API_KEY` when `SUMMARY_BACKEND=api` (the default). The web
server therefore refuses to start without an Anthropic key, though no page calls Anthropic.

---

## 2. Routes and screens

Every page is a Server Component that returns one screen from a feature's `server.ts`
(`src/app/pages.test.ts` checks it). There are no route handlers (`route.ts`), no
`loading.tsx`, no `error.tsx` and no `not-found.tsx`. The `/auth/callback` route that
`supabase/config.toml` lists does not exist.

| Route             | Purpose                                  | Reads                                                                                                                   | Writes                                                                                              | Main components                                                                                                                                                                      | State                                                                                                         |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/login` (public) | Sign in or create an account             | `searchParams.next`                                                                                                     | Supabase Auth, through the server action `authenticate` (`auth/actions/authenticate.ts`)            | `LoginScreen` (RSC), `SignInForm` (client)                                                                                                                                           | working                                                                                                       |
| `(app)` layout    | Shell and navigation for signed-in pages | `requireUser()` and `countPositions()`, both through the Supabase server client                                         | —                                                                                                   | `AppShell`, `Sidebar`, `NavItem` (client), `Wordmark`, `AccountSummary` (with the `signOut` action)                                                                                  | working                                                                                                       |
| `/` (Review)      | News on the instruments the user holds   | `listPositions()` then `listFeed()`: `articles`, `article_instruments`, `summaries`, through the Supabase server client | —                                                                                                   | `ReviewScreen` (RSC) → `ReviewLayout`, `ReviewHeader`, `NewsFeed`, `FeedCard`, `ArticleFeedCard`, `TonalityBadge`, `ProvenanceLine`, `CoverageList`, `CoverageRow`, `FeedDisclaimer` | working, partial: the latest 50 articles, no time window, no pagination (`docs/improvements.md`, ui and news) |
| `/portfolio`      | Add, edit and remove positions           | `listInstruments()` and `listPositions()` through the Supabase server client                                            | `portfolio_positions`, through the server actions `addPosition`, `updatePosition`, `removePosition` | `PortfolioScreen` (RSC) → `PortfolioSection`, `AddPositionForm` (client), `InstrumentPicker`, `PositionRow` (client), `EditPositionForm` (client)                                    | working                                                                                                       |
| Themes, Settings  | Nav entries                              | —                                                                                                                       | —                                                                                                   | `NavItem` with `href={null}`                                                                                                                                                         | stub: rendered disabled                                                                                       |

Client components: `SignInForm`, `AddPositionForm`, `EditPositionForm`, `PositionRow`,
`SubmitButton`, `NavItem`. Everything else renders on the server.

`src/middleware.ts` runs on every non-asset request. It refreshes the Supabase session,
redirects anonymous visitors to `/login?next=…`, and sends signed-in visitors away from
`/login`. Paths come from `src/shared/routes.ts`.

---

## 3. Backend inside the web app

Fates: **REPLACED** (the API covers it; the endpoint is named), **GAP** (needed, but the API
does not offer it), **DROP** (no longer needed). API paths are under `/api/v1`.

### Request-time code (runs for a signed-in user)

| Code                                                          | What it does                                                                   | Fate                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/actions/authenticate.ts`                                | `signInWithPassword` or `signUp`, then a redirect to `next`                    | REPLACED: `POST /auth/login` (form `username`, `password`) and `POST /auth/register` (JSON). Register returns the user, not tokens, so a login must follow                                                                                                  |
| `auth/actions/sign-out.ts`                                    | `auth.signOut()`, redirect to `/login`                                         | REPLACED: `POST /auth/logout`                                                                                                                                                                                                                               |
| `auth/data/current-user.ts` (`getCurrentUser`, `requireUser`) | `auth.getUser()`                                                               | REPLACED: `GET /users/me` with the bearer token                                                                                                                                                                                                             |
| `shared/supabase/middleware.ts` (`updateSession`)             | Refreshes the session cookie on each request                                   | REPLACED: `POST /auth/refresh`. The mechanism has to change; see section 5                                                                                                                                                                                  |
| `instruments/data/instrument-directory.ts` `listInstruments`  | Every active instrument, for the `<select>`                                    | REPLACED: `GET /instruments` (paginated). A picker over the whole directory no longer fits; search replaces it                                                                                                                                              |
| `instrument-directory.ts` `searchInstruments`                 | `ilike` on ticker and name. Exported, never called                             | REPLACED: `GET /instruments/search?q=`, then `POST /instruments/resolve` for a Yahoo candidate                                                                                                                                                              |
| `instrument-directory.ts` `getInstrumentByTicker`             | One instrument by ticker. Exported, never called                               | DROP (`GET /instruments/{id}` covers the instrument page)                                                                                                                                                                                                   |
| `portfolio/data/portfolio-queries.ts` `listPositions`         | All the user's positions with their instrument                                 | REPLACED per portfolio: `GET /portfolios/{id}/positions`. **GAP** for "all positions across portfolios", which the Review screen and the nav need                                                                                                           |
| `portfolio-queries.ts` `countPositions`                       | The nav's position count                                                       | **GAP**: pages have no total (`apps/api/docs/improvements.md`, Pagination). Or drop the count                                                                                                                                                               |
| `portfolio/actions/position-actions.ts`                       | Insert, update, delete a position                                              | REPLACED: `POST`, `PATCH`, `DELETE /portfolios/{id}/positions[/{position_id}]`                                                                                                                                                                              |
| `news/data/feed-queries.ts` `listFeed`, `listFeedWith`        | Canonical articles linked to the held instruments, with a per-article tonality | **GAP** for one feed across held securities: no `GET /news` (deferred, `apps/api/docs/improvements.md`, News). REPLACED per instrument: `GET /instruments/{id}/news` and `GET /instruments/{id}/brief`. The per-article tonality is DROP: tone is per brief |

### Batch code (runs outside requests, on the Supabase admin client)

| Code                                                                                                                                                                                                      | What it does                                                                            | Fate                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/ingestion/` (adapters `finnhub.ts`, `rss.ts`; pipeline `normalize`, `dedup`, `match`, `run-ingestion`; `embeddings/embedder.ts`; `data/ingestion-repository.ts`) and `scripts/ingest-news.ts`   | Finnhub and RSS fetch, normalise, hash and embedding dedup, instrument matching, insert | REPLACED: `just ingest-news` (`apps/api` job, Google News RSS, ADR api 0010)                                                                                                                                                                          |
| `features/summarization/` (`client/*-completion.ts`, `classify-article.ts`, `prompts/tonality-prompt.ts`, `data/summarization-repository.ts`, `pipeline/run-summarization.ts`) and `scripts/summarize.ts` | Per-article tonality with Claude Haiku, through the API or the `claude` CLI             | REPLACED: `just brief` (`apps/api` job, ADRs api 0010 and 0011)                                                                                                                                                                                       |
| `scripts/seed-instruments.ts`, `supabase/seed/instruments.json` (38 rows)                                                                                                                                 | Hand-written instrument universe                                                        | DROP: instruments enter the API by resolving a Yahoo symbol or by CSV import                                                                                                                                                                          |
| `scripts/seed-feeds.ts`, `supabase/seed/feeds.json` (9 feeds)                                                                                                                                             | RSS feed list                                                                           | DROP                                                                                                                                                                                                                                                  |
| `supabase/migrations/` (9 files)                                                                                                                                                                          | The schema, RLS policies and grants                                                     | DROP: the API's Alembic migrations own the schema                                                                                                                                                                                                     |
| RPC `match_articles` (`20260910120100_match_articles.sql`)                                                                                                                                                | Vector nearest neighbours for dedup                                                     | DROP                                                                                                                                                                                                                                                  |
| `.github/workflows/ingest.yml`                                                                                                                                                                            | Nightly ingest and summarise at 06:00 UTC                                               | DROP. It is under `apps/web/.github/`, which GitHub does not read: it has not run since the monorepo move. The API's jobs (`ingest-news`, `brief`, `update-prices`) run by hand, with no scheduler: a **GAP** for anything deployed, owned by the API |
| Edge functions                                                                                                                                                                                            | —                                                                                       | not found (`supabase/functions/` does not exist; `[edge_runtime]` is enabled in `config.toml` but unused)                                                                                                                                             |
| `digests` table                                                                                                                                                                                           | Per-user digest rows                                                                    | DROP: no code writes or reads it outside `tests/db/`                                                                                                                                                                                                  |

---

## 4. Data model

Supabase tables (`supabase/migrations/`, typed in `src/shared/supabase/database.types.ts`)
against the API's tables (`users`, `refresh_tokens`, `instruments`, `daily_prices`,
`portfolios`, `positions`, `articles`, `article_instruments`, `briefs`, `brief_articles`) and
their response schemas.

### Instruments

| Supabase `instruments`                         | API `InstrumentRead`                                      | Note                                                        |
| ---------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `id` (uuid v4)                                 | `id` (uuid v7)                                            | both strings                                                |
| `ticker` (unique, `AAPL`)                      | `yahoo_symbol` (unique, `MC.PA`)                          | **renamed**; carries an exchange suffix                     |
| —                                              | `exchange_code` (`PAR`, `NMS`), `currency` (`EUR`, `GBP`) | **new**: one row per listing                                |
| `isin` (unique when set, null across the seed) | `isin` (nullable, not unique)                             | two listings of one security share it                       |
| —                                              | `share_class_figi`                                        | **new**: groups listings of one security (MC.PA and MOH.DE) |
| `name`, `type` (`stock`, `etf`)                | `name`, `type` (`stock`, `etf`)                           | same                                                        |
| `macro_bucket`                                 | —                                                         | **gone**                                                    |
| `active`                                       | —                                                         | **gone**                                                    |
| —                                              | `created_at`, `updated_at`                                | exposed                                                     |

Search returns two kinds of item (`LocalSearchResult` with an `id`, `YahooSearchResult`
without one) plus `yahoo_unavailable`. A Yahoo item must be resolved before it can be held.

### Portfolios and positions

| Supabase                                                               | API                                                                                     | Note                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| —                                                                      | `portfolios` (`PortfolioRead`: `id`, `name`, timestamps)                                | **new**: any number per user, names unique per user                      |
| `portfolio_positions.user_id`                                          | —                                                                                       | a position is owned through its portfolio; `user_id` is never in the API |
| —                                                                      | `positions.portfolio_id` (in the path)                                                  | **new**                                                                  |
| `instrument_id`                                                        | `instrument` (nested `InstrumentRead`) on read, `instrument_id` on write                |                                                                          |
| `quantity` (numeric, required, > 0); the web reads it as a JS `number` | `quantity`: decimal **string**, optional                                                | **type change**: send and receive strings (ADR api 0003, Decimals)       |
| `cost_basis` (numeric, optional, ≥ 0; unit undefined in the web code)  | `average_price`: decimal string, optional, > 0, per share, in the instrument's currency | **renamed, and the meaning is defined**                                  |
| unique `(user_id, instrument_id)`                                      | unique `(portfolio_id, instrument_id)`                                                  | one instrument can now sit in several portfolios                         |

### News

| Supabase                                                                                                                                     | API                                                                                                                                                                                                                        | Note                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `articles.source` (outlet name)                                                                                                              | `ArticleRead.publisher`                                                                                                                                                                                                    | **renamed**. The API's `articles.source` is the provider (`google_news`) and is not in the response |
| `articles.url` (publisher or `finnhub.io` redirect)                                                                                          | `url` (a `news.google.com/rss/articles/…` link, not decoded)                                                                                                                                                               |                                                                                                     |
| `title`, `published_at`                                                                                                                      | `title`, `published_at`                                                                                                                                                                                                    | same                                                                                                |
| `raw_content` (teaser)                                                                                                                       | —                                                                                                                                                                                                                          | **gone**: the card body has no source                                                               |
| `content_hash`, `embedding`, `canonical_article_id`, `ingested_at`                                                                           | — (`title_key` is internal)                                                                                                                                                                                                | **gone**                                                                                            |
| `article_instruments.confidence`, `match_method`                                                                                             | —                                                                                                                                                                                                                          | **gone**: a link is `(article_id, instrument_id)`                                                   |
| `summaries` (per article: `tonality` bullish/neutral/bearish, `confidence`, `instruments_mentioned`, `model`, `prompt_version` text, tokens) | `briefs` (per security group: `text`, `tone`, `model` such as `api:claude-haiku-5-5`, `prompt_version` integer, `period_start`, `period_end`, `generated_at`, cited `articles`, computed `provenance`, fixed `disclaimer`) | **replaced by a new concept**: one brief per security with the headlines it cites                   |
| tonality `bullish` / `neutral` / `bearish`                                                                                                   | tone `positive` / `negative` / `neutral` / `mixed`                                                                                                                                                                         | **new vocabulary**; ADR api 0010 avoids "bullish" and "bearish" on purpose                          |
| `feeds`                                                                                                                                      | —                                                                                                                                                                                                                          | **gone**                                                                                            |
| `digests`                                                                                                                                    | —                                                                                                                                                                                                                          | **gone**                                                                                            |

ETFs get no news in the API (ADR api 0010). News and briefs are read through any listing of a
share class: MOH.DE answers with what was fetched for MC.PA.

### Other new concepts

| Concept      | API                                                                                                                     | Web today             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Daily prices | `daily_prices`, read by `GET /instruments/{id}/prices?from=&to=` (open, high, low, close, adj_close as strings, volume) | not found             |
| CSV import   | `POST /portfolios/{id}/import` (`dry_run`, per-row report)                                                              | not found             |
| Users        | `users` (`UserRead`: `id`, `email`, timestamps)                                                                         | Supabase `auth.users` |
| Watchlist    | **not found**: removed from the API in `c909d91` (`refactor: remove watchlist feature`)                                 | not found             |

### Response conventions the web must adopt

- Lists are `{ items, next_cursor }`, keyset-paginated, newest first; `limit` 1 to 100, default 20. No totals.
- Errors are `{ code, message, details }` for every status, including 422 and 500 (ADR api
  0003). Codes the client can switch on: `invalid_credentials`, `invalid_file`,
  `file_too_large`, among others.
- Another user's resource answers 404, like a missing one.

---

## 5. Auth

### Today (Supabase)

- Email and password; `enable_confirmations = false`, so sign-up signs in at once
  (`supabase/config.toml`, ADR web 0002). No password reset.
- `@supabase/ssr` keeps the session in cookies on the app's own origin. `middleware.ts`
  refreshes it on every request with `auth.getUser()` and gates every route but `/login`.
- Server Components, server actions and the middleware all read the same cookie through
  `createSupabaseServerClient()`. The browser client (`createSupabaseBrowserClient`) is
  exported but never called.
- Authorisation is RLS in Postgres; the web code never filters by `user_id`.
- The form allows passwords of 8 characters or more (`authenticate.ts`, `sign-in-form.tsx`).

### What the API expects (ADR api 0005, `apps/api/src/app/modules/auth/router.py`)

| Step     | Endpoint              | Detail                                                                                                                                         |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Register | `POST /auth/register` | JSON `{ email, password }`, password 12 to 128 characters; 201 with `UserRead`, no tokens                                                      |
| Login    | `POST /auth/login`    | form-encoded `username` (the email) and `password`; returns `{ access_token, token_type: "bearer", expires_in }` and sets the refresh cookie   |
| Calls    | any                   | `Authorization: Bearer <access_token>`; the token lives 15 minutes                                                                             |
| Refresh  | `POST /auth/refresh`  | reads the cookie, returns a new access token, replaces the cookie. Each refresh token works once; reusing one revokes all of the user's tokens |
| Logout   | `POST /auth/logout`   | revokes the cookie's token and clears it                                                                                                       |
| Who am I | `GET /users/me`       | `UserRead`                                                                                                                                     |

The refresh cookie is `refresh_token`, `HttpOnly`, `Secure`, `SameSite=Strict`,
`Path=/api/v1/auth`, 30 days. Where the access token lives is the client's choice; ADR api 0005
intends "sessions that outlive a short access token without exposing a long-lived credential
to JavaScript", which points at memory for the access token.

### Blockers and constraints

| Issue                   | Detail                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No CORS**             | `apps/api/src/app/main.py` adds no `CORSMiddleware`. A browser on another origin (`localhost:3000` against `localhost:8000`) cannot call the API at all, and `apps/api` is not to be modified. The browser must therefore reach the API on the web app's own origin: a Next rewrite or route-handler proxy from `/api/v1/*` |
| **`SameSite=Strict`**   | The cookie is sent only on same-site requests. On different sites (say, the web on Vercel and the API elsewhere) it is never sent and refresh cannot work. A same-origin proxy, or a shared registrable domain, is required in production                                                                                   |
| **`Path=/api/v1/auth`** | The browser sends the cookie only to `/api/v1/auth/*`. A page request (`GET /portfolio`) does not carry it, so neither the Next middleware nor a Server Component can see that a session exists                                                                                                                             |
| **SSR has no token**    | An access token held in browser memory never reaches the Next server. Server Components cannot fetch user data unless the Next server holds its own session (a backend-for-frontend storing tokens in its own httpOnly cookies), or the data fetching moves to the client                                                   |
| **Route gating**        | `middleware.ts` relies on a session cookie readable on every request. With the API's cookie scoped to `/api/v1/auth`, a server-side redirect to `/login` needs either a cookie of the web app's own or a client-side guard                                                                                                  |
| **`Secure` on http**    | Login over `http://localhost` stores a `Secure` cookie only where the browser treats localhost as a secure context. Chrome and Firefox do; Safari's behaviour was not verified                                                                                                                                              |
| **Concurrent refresh**  | Two tabs refreshing at once look like reuse and log the user out everywhere (ADR api 0005, Consequences). The client needs one refresh in flight at a time, across tabs                                                                                                                                                     |
| **Stale cookie**        | A failed refresh (401) leaves the cookie in place (`apps/api/docs/improvements.md`, Auth)                                                                                                                                                                                                                                   |
| **Password rule**       | The web allows 8 characters; the API requires 12                                                                                                                                                                                                                                                                            |
| **Next 16**             | `middleware.ts` is deprecated in favour of `proxy.ts` (build warning)                                                                                                                                                                                                                                                       |

---

## 6. UI building blocks

**Design reference.** No mention of Trade Republic was found in the repository. The docs refer
to "the mockup" (`docs/improvements.md`, ui section); the mockup itself is not in the
repository. The look is one dark theme (black canvas, near-black surfaces, white text, warm
and cool avatar tints, orange and teal tones), set in `src/shared/ui/theme.css`.

**Theme.** Tailwind's defaults are reset; only the tokens in `theme.css` generate utilities:
colours scoped to `bg-`, `text-` and `border-`, type roles (`text-display` to `text-meta`),
spacing roles (`px-gutter`, `p-card`, …), sizes, radii and opacities. `theme.test.ts` compiles
the theme and fails on any class that generates no CSS. `cn()` merges classes with these tokens.

**Layout.** `(app)/layout.tsx` renders `AppShell` (sidebar plus `<main>`), with a 224px
`Sidebar` (wordmark, nav, account footer). The Review screen adds a right rail. The sidebar is
desktop only (`docs/improvements.md`, ui).

| Component                                                                 | Where                               | Keep as is?                                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `theme.css`, `cn.ts`, `theme.ts`, `theme.test.ts`                         | `shared/ui/`                        | keep                                                                                                 |
| `Avatar`, `Icon`, `Wordmark`                                              | `shared/ui/display/`                | keep                                                                                                 |
| `TextField`, `SelectField`                                                | `shared/ui/input/`                  | keep (accessible labels, hints and errors)                                                           |
| `SubmitButton`                                                            | `shared/ui/form/`                   | keep while forms submit through `<form action>`; it depends on `useFormStatus`                       |
| `AppShell`, `Sidebar`                                                     | `shared/ui/layout/`                 | keep                                                                                                 |
| `NavItem`                                                                 | `shared/ui/navigation/`             | keep                                                                                                 |
| `AccountSummary`                                                          | `auth/components/display/`          | adapt: sign-out calls the API                                                                        |
| `SignInForm`                                                              | `auth/components/form/`             | adapt: separate register (12-character rule) from sign-in                                            |
| `InstrumentAvatar`                                                        | `instruments/components/display/`   | adapt: label from `yahoo_symbol`                                                                     |
| `InstrumentPicker`                                                        | `instruments/components/input/`     | replace with a search field over `GET /instruments/search`                                           |
| `PortfolioSection`, `AddPositionForm`, `EditPositionForm`, `PositionRow`  | `portfolio/components/`             | adapt: portfolio id, optional quantity, `average_price`, decimal strings, listing and currency shown |
| `ReviewLayout`, `ReviewHeader`, `NewsFeed`, `CoverageList`, `CoverageRow` | `news/components/`                  | adapt to briefs and per-instrument news                                                              |
| `FeedCard`, `ArticleFeedCard`                                             | `news/components/card/`             | adapt: no teaser, no per-article tone                                                                |
| `ProvenanceLine`                                                          | `news/components/display/`          | adapt: the brief carries its own `provenance` string                                                 |
| `FeedDisclaimer`                                                          | `news/components/display/`          | replace its text with the brief's `disclaimer`                                                       |
| `TonalityBadge`                                                           | `summarization/components/display/` | adapt to `Tone` (four values) and move out of `summarization`, which is otherwise deleted            |

---

## 7. Screens for the new API

| API feature          | Endpoints                                                                   | Screen today                                              | Verdict                                                                                 |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Account              | `register`, `login`, `refresh`, `logout`, `users/me`                        | `/login`, `AccountSummary`                                | adapt                                                                                   |
| Search and resolve   | `GET /instruments/search`, `POST /instruments/resolve`                      | `InstrumentPicker`, a `<select>` over the seeded universe | missing (a combobox to build)                                                           |
| Portfolios           | `POST`, `GET`, `PATCH`, `DELETE /portfolios[/{id}]`                         | none: `/portfolio` assumes one implicit portfolio         | missing (list, create, rename, delete, or a switcher)                                   |
| Positions            | `POST`, `GET`, `PATCH`, `DELETE /portfolios/{id}/positions[/{position_id}]` | `/portfolio`                                              | adapt                                                                                   |
| CSV import           | `POST /portfolios/{id}/import?dry_run=`                                     | none                                                      | missing (upload, dry-run report, confirm)                                               |
| Watchlist            | none (removed in `c909d91`)                                                 | none                                                      | not applicable                                                                          |
| Instrument page      | `GET /instruments/{id}`                                                     | none                                                      | missing (no `/instruments/[id]` route)                                                  |
| Price history        | `GET /instruments/{id}/prices`                                              | none; no chart library                                    | missing                                                                                 |
| News per instrument  | `GET /instruments/{id}/news`                                                | none                                                      | missing (belongs on the instrument page)                                                |
| Brief per instrument | `GET /instruments/{id}/brief`                                               | none                                                      | missing (belongs on the instrument page)                                                |
| Home feed            | none (`GET /news` deferred)                                                 | `/` (Review)                                              | adapt, with one brief and one news call per held security, or after the API adds a feed |

---

## 8. Dependencies and config that become unused

### Dependencies

| Package                                  | Why it goes          | Note                                           |
| ---------------------------------------- | -------------------- | ---------------------------------------------- |
| `@supabase/ssr`, `@supabase/supabase-js` | Supabase clients     |                                                |
| `supabase` (dev)                         | Supabase CLI         |                                                |
| `@anthropic-ai/sdk`                      | summarisation        |                                                |
| `@huggingface/transformers`              | embeddings           | pulls in `onnxruntime-node` and a `sharp` 0.34 |
| `fast-xml-parser`                        | RSS adapter          |                                                |
| `tsx` (dev)                              | only runs `scripts/` |                                                |

Kept: `next`, `react`, `react-dom`, `zod`, `clsx`, `tailwind-merge`, `lucide-react`, and the
dev tooling.

In `pnpm.onlyBuiltDependencies`: `onnxruntime-node` goes with transformers. `sharp` stays
(Next depends on it too). `esbuild` stays (vite, under vitest). `unrs-resolver` is not in the
dependency tree today (`pnpm why` finds nothing): a stale entry.

### Config and files

- `supabase/` (`config.toml`, `migrations/`, `seed/`, `.gitignore`). `config.toml` lists
  `./seed.sql`, which does not exist.
- `src/shared/supabase/` (`admin.ts`, `client.ts`, `server.ts`, `middleware.ts`,
  `postgrest.ts` and its test, `database.types.ts`).
- `src/shared/collections.ts` (`chunk`, `LOOKUP_CHUNK`): exists only to avoid PostgREST 414s.
- `src/features/ingestion/`, `src/features/summarization/` (bar `TonalityBadge` and
  `TonalitySchema`, which the news feature uses), `scripts/`.
- `tests/db/` and the `db` project in `vitest.config.ts`.
- `vitest.setup.ts`: the Supabase and Anthropic placeholder variables.
- `.env.example`, `env.ts`, `server-env.ts`: every variable marked drop in section 1.
- `biome.jsonc`: the `database.types.ts` exclusion and the `ingestion` and `summarization`
  overrides.
- `commitlint.config.js`: the `ingestion`, `summarization` and `db` scopes.
- `.github/workflows/ingest.yml`, and the `rls` job and Supabase steps of `ci.yml`.
- `CODE_STANDARDS.md`: the Supabase clients table (§1.4), PostgREST rules (§4, §6.2), pipelines
  and LLM calls (§6.4, §6.5), Database (§8), the db test rules (§9), and the "Adding a table"
  and "Adding an ingestion source" checklists.
- `README.md`: the Database, Auth, Ingestion, Summarisation and Home feed sections.
- `docs/improvements.md`: the ingestion and summarisation sections, and the entries whose
  subject is gone.

---

## 9. Tests and quality

| Check            | Result today                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | clean (131 files)                                                                                                                                                                                         |
| `pnpm typecheck` | clean                                                                                                                                                                                                     |
| `pnpm test`      | 17 files, 112 tests, all pass                                                                                                                                                                             |
| `pnpm build`     | succeeds; warns that `middleware` is deprecated for `proxy`                                                                                                                                               |
| `pnpm test:db`   | not run (needs the Supabase stack)                                                                                                                                                                        |
| CI               | **not running**: `ci.yml` and `ingest.yml` sit in `apps/web/.github/workflows/`, and GitHub reads only the repository root's `.github/`. The root has an untracked `.github/workflows/api.yml` (API only) |

### Unit test files

| Fate  | Files                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep  | `src/app/pages.test.ts`, `src/shared/routes.test.ts`, `src/shared/ui/theme.test.ts`                                                                                                                                                                                 |
| Adapt | `instruments/schemas/instrument.schema.test.ts`, `portfolio/schemas/portfolio.schema.test.ts`, `news/components/layout/review-layout.test.tsx`, `news/components/list/coverage-list.test.tsx`, `news/components/list/news-feed.test.tsx`                            |
| Drop  | `ingestion/adapters/rss.test.ts`, `ingestion/pipeline/{dedup,match,normalize}.test.ts`, `summarization/client/{api-completion,classify-article,claude-cli-completion}.test.ts`, `summarization/schemas/summary.schema.test.ts`, `shared/supabase/postgrest.test.ts` |

`tests/db/` (`rls`, `feed`, `ingestion`, `summarization`) all drop: authorisation now lives in
the API, which tests every user-owned endpoint with a second user (ADR api 0005).

Gaps: no tests on server actions or screens; no end-to-end tests. No test drives the auth flow.

---

## 10. The web ADRs

`apps/api/docs/adr/0010` and `0011` link to web ADRs 0004, 0005, 0006 and 0007 by relative
path, as the evidence their decisions start from. Those files must stay where they are; a
superseded record is marked, not deleted.

| ADR                                                                         | One line                                                                                                  | Verdict                                                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](adr/0001-schema-and-data-model.md) Schema and data model             | Shared articles and summaries, per-user holdings, all in Supabase                                         | superseded by api 0004 (database), 0006 (instruments), 0009 (portfolios), 0010 (news storage)                                                                                |
| [0002](adr/0002-auth-and-rls.md) Auth and RLS                               | Password auth; deny-by-default RLS with explicit grants                                                   | superseded by api 0005                                                                                                                                                       |
| [0003](adr/0003-instruments-and-portfolio.md) Instruments and portfolio     | Seeded universe behind one lookup module; RSC reads, server actions; routes registry; `(app)` route group | data parts superseded by api 0006 and 0009; the web parts (route group, routes registry, how reads and mutations happen) need a new web record once the data layer is chosen |
| [0004](adr/0004-ingestion-pipeline.md) Ingestion pipeline                   | Pure stages, Finnhub and RSS, embedding dedup                                                             | superseded by api 0010 (which cites it)                                                                                                                                      |
| [0005](adr/0005-summarization-and-tonality.md) Summarisation and tonality   | Tonality only, per article                                                                                | superseded by api 0010 (briefs)                                                                                                                                              |
| [0006](adr/0006-home-feed.md) Home feed                                     | Polymorphic cards; provenance states only what was produced; two empty states                             | needs updating: the UI rules still apply; the data (articles with per-article tonality from Supabase) is superseded by api 0010                                              |
| [0007](adr/0007-local-summarization-backend.md) Local summarisation backend | One `Completion` contract; a `claude` CLI backend                                                         | superseded by api 0011                                                                                                                                                       |

---

## 11. Risks and open questions

1. **Session architecture is the first decision**, and everything else depends on it. The
   API's cookie (`Strict`, scoped to `/api/v1/auth`) and its lack of CORS rule out a browser
   calling the API on another origin, and keep the session invisible to the Next server. The
   realistic options are a same-origin proxy with client-side data fetching, or a
   backend-for-frontend in Next that holds the tokens in its own cookies and keeps Server
   Components. Both work without changing `apps/api`.
2. **No cross-portfolio reads.** The Review screen and the nav count need all of a user's
   positions; the API offers them one portfolio, one page at a time.
3. **No home feed endpoint.** One brief and one news call per held security works for a
   handful of securities and grows linearly. `GET /news` is listed as deferred in
   `apps/api/docs/improvements.md`.
4. **No totals.** "7 articles kept", "12 positions" and similar counts need every page fetched.
5. **Data freshness.** Ingestion, briefs and prices are commands run by hand. Without a
   scheduler, a deployed web app shows whatever was last run.
6. **Watchlist.** The step's brief lists it as an API concept; the API removed it in
   `c909d91`. To confirm it is out of scope.
7. **Decimals are strings.** Quantities and prices must not pass through `Number` for
   arithmetic. The API computes no value or performance (ADR api 0009); a "portfolio value"
   would be computed in the web from positions and the latest close.
8. **Search per keystroke** asks Yahoo each time when local results are thin
   (`apps/api/docs/improvements.md`, Instruments): the field must debounce.
9. **Typed client.** The web's types came from `supabase gen types`. Generating them from
   `/openapi.json` (for example with `openapi-typescript`) is the obvious replacement; not
   decided.
10. **Tone vocabulary.** `TonalityBadge` maps bullish and bearish to "Constructive" and
    "Adverse"; the API's tone has four values, including `mixed`.
11. **ETFs have no news** in the API; the coverage rail would list every ETF under "No news".
12. **Design reference missing.** The mockup the docs cite is not in the repository.
13. **CI is not running** for the web (workflows under `apps/web/.github/`).
14. **Next 16 deprecations.** `middleware.ts` should become `proxy.ts`; worth doing in the
    auth step rather than separately.
15. **Fonts at build.** `next/font/google` downloads Inter at build time, so a build needs
    network access.

---

## 12. Suggested order of work

Input for planning, not a commitment. Each step leaves lint, type-check, tests and build green.

| #   | Kind   | Step                                                                                                                                                                                                                                                                                                                                                                           | Depends on |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | delete | Remove the ingestion and summarisation pipelines: the two features (keeping `TonalityBadge` and `TonalitySchema`, moved into `news`), `scripts/`, their tests, `@anthropic-ai/sdk`, `@huggingface/transformers`, `fast-xml-parser`, `tsx`, their env variables, biome overrides, commitlint scopes, `ingest.yml`, and the matching docs; mark ADRs 0004, 0005, 0007 superseded | —          |
| 2   | wire   | Move web CI to the root (`.github/workflows/web.yml`), lint, type-check, test and build only; drop the `rls` job                                                                                                                                                                                                                                                               | —          |
| 3   | decide | Web ADR for the session and data-fetching architecture (section 11, item 1), and for the typed API client                                                                                                                                                                                                                                                                      | —          |
| 4   | wire   | API client foundation: base URL in env, the same-origin proxy, generated types, the `{code, message, details}` error shape, decimal strings                                                                                                                                                                                                                                    | 3          |
| 5   | wire   | Auth against the API: login, register (12 characters), logout, `users/me`, refresh with one request in flight, route gating; `middleware.ts` to `proxy.ts`; mark ADR 0002 superseded                                                                                                                                                                                           | 4          |
| 6   | wire   | Portfolios: list, create, rename, delete, and a way to pick the current one                                                                                                                                                                                                                                                                                                    | 5          |
| 7   | wire   | Positions per portfolio on the adapted `PortfolioSection` (`average_price`, optional quantity, listing and currency)                                                                                                                                                                                                                                                           | 6          |
| 8   | build  | Instrument search and resolve combobox, replacing `InstrumentPicker`                                                                                                                                                                                                                                                                                                           | 7          |
| 9   | build  | CSV import: upload, dry-run report, confirm                                                                                                                                                                                                                                                                                                                                    | 6          |
| 10  | build  | Instrument page: details, latest brief with cited articles, news list                                                                                                                                                                                                                                                                                                          | 5          |
| 11  | build  | Price chart on the instrument page (adds a chart dependency, to justify then)                                                                                                                                                                                                                                                                                                  | 10         |
| 12  | wire   | Review screen on briefs per held security, with `TonalityBadge` on the four tones; update ADR 0006                                                                                                                                                                                                                                                                             | 7, 10      |
| 13  | delete | Remove Supabase: `src/shared/supabase/`, `supabase/`, `tests/db/`, `shared/collections.ts`, the Supabase packages and env variables, and the Supabase parts of `CODE_STANDARDS.md` and `README.md`; mark ADRs 0001 and 0003 superseded                                                                                                                                         | 5 to 12    |

Steps 1 and 2 are independent of the rest and can go first. Step 13 can only happen once
nothing reads Supabase.
