# Stock News

A daily digest of the news that moved the stocks you actually own.

Next.js App Router · TypeScript (strict) · Tailwind CSS v4 · Zod · Biome · Vitest · pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` / `pnpm lint:fix` | Biome check (lint + format + import sorting) |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest, unit project only |
| `pnpm verify` | lint + typecheck + test — what CI runs |
| `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` | Local Supabase stack (needs Docker) |
| `pnpm db:push` / `pnpm db:types` | Apply migrations / regenerate `database.types.ts` from the local stack |
| `pnpm test:db` | RLS and feed suites against the local stack |

## Architecture

Folders follow **features**, not file types. A feature owns its whole vertical slice, so
adding one means adding a directory rather than touching six shared ones.

```
src/
  app/                    routes only — each page returns one feature screen
  features/
    auth/                 sign-in, session, requireUser()
    instruments/          the instrument universe and its lookup
    portfolio/            positions
    news/                 the digest feed
      screens/            one screen per route: loads data, renders components (server)
      components/         React components, in role folders (layout/, form/, list/, …)
      actions/            server actions
      data/               database and network I/O (server-only)
      schemas/            Zod contracts and derived types
      fixtures/           as needed
      index.ts            public API (client-safe)
      server.ts           public API (server-only)
  shared/
    config/               the typed environment contract
    supabase/             browser, server and admin clients; generated types
    ui/                   form and navigation primitives
  middleware.ts           session refresh and auth redirect
  instrumentation.ts      validates the server env at boot
```

The rules that keep this shape intact — dependency rules, the client/server split, the full
feature directory vocabulary, and checklists for adding a feature, table or env variable —
are in [CODE_STANDARDS.md](CODE_STANDARDS.md).

## External data

Zod schemas are the single source of truth for anything crossing the app's boundary.
Types are derived with `z.infer`, never hand-written alongside a schema, and the schema validates at the edge: see `news/schemas/feed.schema.ts` and its use in `news/data/feed-queries.ts`.
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

- **Commits** follow Conventional Commits with a closed scope list; `commitlint` runs on `commit-msg`.
- **Pre-commit** runs Biome over staged files only. It is a convenience, not a gate — CI
  runs the full suite.
- **Styling** is Tailwind, restricted to the tokens in `src/shared/ui/theme.css` (one dark
  theme). Changing a colour, type role, radius or spacing role there restyles the whole app;
  components carry no raw values.

## Database

Supabase Postgres. The schema lives in `supabase/migrations/` and is applied with
`pnpm db:push`; `pnpm db:types` regenerates `src/shared/supabase/database.types.ts` from
the linked project, so the types are never hand-written.

Three clients, in `src/shared/supabase/`:

| Client | Where | Auth |
| --- | --- | --- |
| `createSupabaseBrowserClient` | client components | user session, RLS applies |
| `createSupabaseServerClient` | RSC / route handlers / actions | user session from cookies, RLS applies |
| `createSupabaseAdminClient` | background work (none today) | secret key, **bypasses RLS** |

Articles and summaries are shared across all users — an article is fetched once and
summarised once per `(model, prompt_version)`. Only positions and digests are
per-user, and those are isolated by RLS on `auth.uid()`.

RLS is on for every table, and grants are explicit: `anon` can read nothing, `authenticated`
reads the shared tables and owns its own rows, `service_role` does the rest. A new table
therefore needs both a policy and a grant — see `20260825120400_grants.sql` for why.

Queries belong in each feature's `data/` directory, behind that feature's `server.ts`.

### Seeding instruments

`supabase/seed/instruments.json` is the hand-written instrument universe, and a unit test parses it against `InstrumentSeedSchema`.
There is no seed script any more: a fresh local Supabase has no instruments, so the Portfolio picker is empty until the table is filled by hand.
Instruments now enter through `apps/api`, which the web is moving onto.

Instrument lookup lives in exactly one module, `instruments/data/instrument-directory.ts`.
Replacing the JSON with a real directory API (EODHD, ESMA FIRDS) changes what fills the
table, not what reads it.

## Auth

Email + password, no confirmation step (`enable_confirmations = false`). `src/middleware.ts`
refreshes the session on every request and redirects anonymous traffic to `/login`, keeping
the original path in `?next=`. Paths are never hand-written — `src/shared/routes.ts` is the
single registry, and `PUBLIC_ROUTES` is what the middleware lets through.

Server code that needs a user calls `requireUser()` from `@/features/auth/server`. It is a
second line of defence: the middleware already redirects, but a route it does not match
must not silently render as nobody.

### Testing the policies

Authorisation is enforced in the database, so the tests talk to a real one. `pnpm test:db`
boots nothing itself — start the stack first:

```bash
pnpm db:start          # needs Docker
pnpm test:db
pnpm db:stop
```

The suite creates two real users, signs them both in, and drives PostgREST with their
tokens, so grants and policies are exercised exactly as they are in production. It asserts
that Bob cannot read, update, delete or impersonate Alice — and that a filtered read comes
back *empty rather than failing*, which is what RLS actually does. Unit tests stay in the
`unit` project and never touch Docker; `pnpm test` runs only those.

## Portfolio

`/portfolio` holds your positions, over the instrument universe. Reads are
Server Components going through the user's session client, so RLS scopes them and no
`user_id` filter is ever written by hand in application code. Mutations are server actions
that `revalidatePath` — no client-side data fetching, no optimistic UI yet.

Users pick from the seeded universe; there is no free-text instrument entry. That is
enforced in the database, not just the picker: the insert policy on `portfolio_positions`
requires the referenced instrument to be `active`. Foreign keys are checked without RLS, so
the constraint had to be spelt out — see `20260909120000_active_instrument_writes.sql`, which
also splits the blanket `for all` policy so that a position stays editable after its
instrument is deactivated.

## Home feed

`/` shows one card per article touching an instrument you hold, most recent first, capped at
`FEED_LIMIT`. Reads are Server Components through the user's session client, so RLS scopes
them; the route resolves holdings and passes the instruments into `listFeed`.

The articles and their tonality were written by the web's own ingestion and summarisation pipelines, now retired: `apps/api`'s `ingest-news` and `brief` jobs replace them.
The feed reads what those pipelines last wrote, and tonality only from the model and prompt version they used, held as constants in `news/data/feed-queries.ts`.

**Every card says where each part came from.**
The body is the outlet's own teaser, not a generated summary (ADR 5 explains why there is nothing to summarise), so the provenance line reads "Headline and teaser from {source}, published … · tonality by {model}, …", and "not yet classified" when no summary exists for the feed's model.
A global disclaimer states that tonality is a machine reading of a headline at a point in time, not a prediction and not advice.

An article matching several of your instruments appears once, listing them all.

Cards are polymorphic: `FeedItemSchema` is a discriminated union on `kind` and `FeedCard`
switches on it, so theme cards become a new union member and a renderer rather than a change
to the feed.

## Decisions and shortcuts

Why the architecture looks the way it does — one record per phase, with the measurements that
drove the non-obvious choices — is in [docs/adr/](docs/adr/).

Known gaps and what they should become live in [docs/improvements.md](docs/improvements.md), grouped by feature: optimistic UI, the real instrument directory, feed pagination.

## Notes

- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Both are far cheaper
  to adopt on day one than to retrofit.
- TypeScript is pinned to 5.9 rather than 7.x, which is new enough that the Next
  type plugin and editor tooling haven't fully settled on it.
