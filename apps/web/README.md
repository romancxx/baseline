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
| `pnpm db:seed` | Upsert both seed files (instruments, feeds) |
| `pnpm ingest` | One ingestion run against the configured database |
| `pnpm summarize` | Classify pending articles (`--dry-run` counts them without spending; `SUMMARY_BACKEND=claude-cli` runs on a Claude subscription) |
| `pnpm test:db` | RLS + ingestion suites against the local stack |

## Architecture

Folders follow **features**, not file types. A feature owns its whole vertical slice, so
adding one means adding a directory rather than touching six shared ones.

```
src/
  app/                    routes only — each page returns one feature screen
  features/
    auth/                 sign-in, session, requireUser()
    instruments/          the instrument universe and its lookup
    portfolio/            positions and watchlist
    ingestion/            fetch → normalize → dedup → match → persist
    summarization/        tonality classification
    news/                 the digest feed
      screens/            one screen per route: loads data, renders components (server)
      components/         React components, in role folders (layout/, form/, list/, …)
      actions/            server actions
      data/               database and network I/O (server-only)
      schemas/            Zod contracts and derived types
      pipeline/ adapters/ client/ prompts/ embeddings/ fixtures/   as needed
      index.ts            public API (client-safe)
      server.ts           public API (server-only)
  shared/
    config/               the typed environment contract
    supabase/             browser, server and admin clients; generated types
    ui/                   form and navigation primitives
  middleware.ts           session refresh and auth redirect
  instrumentation.ts      validates the server env at boot
scripts/                  ingest, summarize and seed entry points
```

The rules that keep this shape intact — dependency rules, the client/server split, the full
feature directory vocabulary, and checklists for adding a feature, table or env variable —
are in [CODE_STANDARDS.md](CODE_STANDARDS.md).

## External data

Zod schemas are the single source of truth for anything crossing the app's boundary.
Types are derived with `z.infer`, never hand-written alongside a schema, and the schema
validates at the edge — see `ingestion/schemas/ingestion.schema.ts` and its use in
`adapters/rss.ts`. Test data is `.parse()`d rather than cast for the same reason: a fixture
that drifts from the contract fails loudly.

## Environment

`.env.example` is the checked-in contract; the two config modules define the shapes. The
app parses and validates at boot — `next.config.ts` for builds, `instrumentation.ts` for
the running server — so a misconfigured deployment fails immediately and with a readable
message, rather than surfacing as `undefined` mid-request.

CI copies `.env.example` to `.env`, which means the example file drifting from the schemas
breaks the build. Set `SKIP_ENV_VALIDATION=true` only for builds that legitimately have no
environment yet (e.g. a Docker image built before secrets are attached).

## Conventions

- **Commits** follow Conventional Commits with a closed scope list; `commitlint` runs on
  `commit-msg`, and CI lints every commit in a PR.
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
| `createSupabaseAdminClient` | ingest, summarisation, digests | secret key, **bypasses RLS** |

Articles and summaries are shared across all users — an article is fetched once and
summarised once per `(model, prompt_version)`. Only positions, watchlist and digests are
per-user, and those are isolated by RLS on `auth.uid()`.

RLS is on for every table, and grants are explicit: `anon` can read nothing, `authenticated`
reads the shared tables and owns its own rows, `service_role` does the rest. A new table
therefore needs both a policy and a grant — see `20260825120400_grants.sql` for why.

Queries belong in each feature's `data/` directory, behind that feature's `server.ts`.

### Seeding instruments

`supabase/seed/instruments.json` is the hand-written instrument universe — the catalogue
source, never a runtime dependency. `pnpm db:seed` validates it against
`InstrumentSeedSchema` and upserts on `ticker`, so it is re-runnable: editing a name and
re-seeding updates the row instead of inserting a second one, and `active` is never
overwritten. A unit test parses the file, so a malformed row fails CI rather than the seed.

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

## Portfolio and watchlist

`/portfolio` holds both, as two sections over the same instrument universe. Reads are
Server Components going through the user's session client, so RLS scopes them and no
`user_id` filter is ever written by hand in application code. Mutations are server actions
that `revalidatePath` — no client-side data fetching, no optimistic UI yet.

Users pick from the seeded universe; there is no free-text instrument entry. That is
enforced in the database, not just the picker: the insert policies on `portfolio_positions`
and `watchlist_items` require the referenced instrument to be `active`. Foreign keys are
checked without RLS, so the constraint had to be spelt out — see
`20260909120000_active_instrument_writes.sql`, which also splits the blanket `for all`
policies so that a position stays editable after its instrument is deactivated.

## Ingestion

`pnpm ingest` — one run of fetch → normalize → dedup → match → persist, driven by
[scripts/ingest-news.ts](scripts/ingest-news.ts) and scheduled nightly at 06:00 UTC by
[.github/workflows/ingest.yml](.github/workflows/ingest.yml). Every stage that can be pure
is pure and unit-tested; only the adapters and the repository touch the outside world, so
adding a source means writing one adapter, not changing the pipeline.

Two sources, because they answer different questions:

- **Finnhub company-news**, queried per symbol over the active stock universe. Paced at one
  request a second to stay inside the free tier, and a failing symbol is logged and skipped
  rather than aborting the run.
- **RSS feeds**, read from the `feeds` table at runtime. Each feed carries a
  `macro_bucket`, which is how index ETFs get news at all — `SPY` has no company news, so
  what moves it arrives as macro coverage.

### Instrument matching

Three rules, each recording its own `match_method` and confidence on
`article_instruments`, so a bad rule can be found and revised later rather than being
invisible in the data:

| Rule | Confidence | Why |
| --- | --- | --- |
| `finnhub-symbol` | 1.0 | The symbol was the query; there is nothing to infer. |
| `rss-mention` | 0.7 | Company name, or a ticker of 3+ characters, found in the text. |
| `rss-bucket` | 0.5 | Article arrived on a feed tagged with this instrument's bucket. |

Two-letter tickers (`V`, `MC`, `OR`, `KO`) are deliberately excluded from text matching —
they collide with ordinary English words and would attach Visa to every article containing
"V". Those instruments still match by company name. When two rules point at the same
instrument, the higher confidence wins.

### Deduplication

Three layers, cheapest first:

1. **Within the run** — repeated urls and content hashes are dropped before anything is
   written. One real run fetched 215 items and kept 51.
2. **Against the database** — `content_hash` (sha256 of the title and body, lowercased and
   stripped of punctuation) and `url` are both unique, and inserts use
   `ignoreDuplicates`. This is what makes a re-run a no-op: the second run of the day
   inserts nothing and raises nothing.
3. **Near-duplicates** — the article is embedded locally (`bge-small-en-v1.5`, 384 dims, no
   API and no per-article cost) and compared against recent canonical articles through the
   `match_articles` RPC, which is `service_role`-only because PostgREST cannot express a
   `<=>` query.

A near-duplicate is **kept**, not discarded: the row is stored with
`canonical_article_id` pointing at the copy that arrived first. Provenance survives, the
same URL is never re-embedded on the next run, and summarisation only ever has to look at
rows where `canonical_article_id is null`.

The threshold (`NEAR_DUPLICATE_DISTANCE`) is the weakest part of this. Measured over 403
real articles, "same story, different outlet" and "same stock, different story" overlap
between roughly 0.10 and 0.14 — a headline plus one sentence does not carry enough signal
to tell them apart. The default is therefore a tight 0.08, which catches only near-verbatim
rewording and misses most real duplicates, because the two errors are not symmetric: a
false collapse means an article is never summarised and the story silently vanishes, while
a missed duplicate only costs a repeated line. See
[docs/improvements.md](docs/improvements.md) for what fixing it properly would take.

## Summarisation

`pnpm summarize` classifies canonical articles with Claude Haiku and writes one row per
`(article_id, model, prompt_version)`. Scheduled straight after ingest in the same job, so
a failed fetch never produces a half-stale digest.

**`summary_text` is deliberately null.** Article bodies from these sources average **260
characters** — a headline plus one teaser sentence. A 2–3 line summary of that is longer
than its input, so the phase generates only what the text can actually support: `tonality`,
the model's own `confidence`, and `instruments_mentioned`. The column and its validation are
in place for when fuller article text exists.

Three things make a re-run safe and a model swap measurable:

- **The prompt is versioned in code** (`prompts/tonality-prompt.ts`) and its version is part
  of the row key. Bumping `SUMMARY_PROMPT_VERSION` produces a *new* row rather than
  overwriting the old one, so a prompt regression can be compared against instead of merely
  discovered. The runner warns when the file and the env var disagree.
- **`model` is on every row**, so two models can be run over the same articles and compared.
- **Token counts and a cost estimate are stored and logged per run.** The prices live in the
  env next to `SUMMARY_MODEL`, because they belong to it — change the model and they must
  change too.

Only articles with an instrument link of at least `MIN_MATCH_CONFIDENCE` (0.7) are
classified: Finnhub's per-symbol news and text mentions, not ETF bucket matches. `MAX_SUMMARIES_PER_RUN`
bounds the bill, and `--dry-run` reports what a run *would* cost.

### Running it locally without an API key

Set `SUMMARY_BACKEND=claude-cli` in `.env.local` and `pnpm summarize` sends each request
through the local `claude` CLI instead, billed to the Claude subscription it is logged in to.
`ANTHROPIC_API_KEY` is then not required. Prompt, schema, verification and retry are the same
code for both backends; only the transport differs. Rows are written under the same
`SUMMARY_MODEL`, so the local feed shows them.

Expect about 10 seconds per article, and usage counted against the subscription's limits —
lower `MAX_SUMMARIES_PER_RUN` for local runs. Token counts include the CLI's own overhead, so
the cost estimate is notional. This backend is for a developer's own machine; CI and anything
deployed use `api`.

### Forced JSON, and what it does not cover

The request constrains the response with `output_config.format`, so the model returns an
object matching the schema rather than prose that has to be salvaged — no fenced code
blocks, no `"tonality": "slightly positive"`. Zod then re-validates, because the API
guarantees the *shape* and not the rules: tickers that are really company names ("Coca
Cola"), or symbols outside the universe. A rejection triggers exactly one corrective retry
carrying the reason; if that also fails, no row is written and the next run picks the
article up again. Retries and failures are both counted in the run summary.

## Home feed

`/` shows one card per article touching an instrument you hold or watch, most recent first,
capped at `FEED_LIMIT`. Reads are Server Components through the user's session client, so RLS
scopes them; the route resolves holdings and watchlist and passes the instruments into
`listFeed`.

**Every card says where each part came from.** The body is the outlet's own teaser, not a
generated summary — ADR 5 explains why there is nothing to summarise — so the provenance line
reads "Headline and teaser from {source}, published … · tonality by {model}, …", and "not yet
classified" when no summary exists for the configured model. A global disclaimer states that
tonality is a machine reading of a headline at a point in time, not a prediction and not
advice.

Holdings and watchlist entries are distinguished by their chip, and an article matching several
of your instruments appears once, listing them all.

Cards are polymorphic: `FeedItemSchema` is a discriminated union on `kind` and `FeedCard`
switches on it, so theme cards become a new union member and a renderer rather than a change
to the feed.

## Decisions and shortcuts

Why the architecture looks the way it does — one record per phase, with the measurements that
drove the non-obvious choices — is in [docs/adr/](docs/adr/).

Known gaps and what they should become live in [docs/improvements.md](docs/improvements.md),
grouped by feature — optimistic UI, the real instrument directory, tonality evaluation.

## Notes

- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Both are far cheaper
  to adopt on day one than to retrofit.
- TypeScript is pinned to 5.9 rather than 7.x, which is new enough that the Next
  type plugin and editor tooling haven't fully settled on it.
