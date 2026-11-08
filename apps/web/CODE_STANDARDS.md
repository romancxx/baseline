# Code standards

The rules every change to this codebase follows. They are derived from the code as it stands,
not from a style guide written in advance — where a rule exists, there is a file that already
does it right, and it is named.

Each rule is tagged with what holds it in place:

- **[lint]** Biome (`biome.jsonc`) — fails `pnpm lint` and CI.
- **[tsc]** TypeScript (`tsconfig.json`) — fails `pnpm typecheck` and CI.
- **[db]** Postgres itself — a constraint, policy or grant.
- **[test]** A test fails if the rule is broken.
- **[commit]** The root `commit-msg` hook (`lefthook.yml`).
- **[review]** Convention only. Nothing catches it but a reader, so read for it.

`pnpm verify` runs everything CI runs except the build.

---

## 1. Architecture

### 1.1 Layers

```
src/
  app/                  routes only — each page returns one feature screen
  features/<name>/      one vertical slice per feature
  shared/               the bottom of the stack: config, clients, UI primitives, utilities
  middleware.ts         session refresh + auth redirect
  instrumentation.ts    validates the server env at boot
supabase/migrations/    the schema; the only place it is defined
tests/db/               integration suite against a real local Supabase stack
```

Folders follow **features**, not file types. Adding a feature means adding a directory, not
touching six shared ones.

### 1.2 Feature directory vocabulary

A feature only has the directories it needs, but a directory's name always means the same
thing. Do not invent a new name for something one of these already covers.

| Directory | Holds | Runs on | Example |
| --- | --- | --- | --- |
| `screens/` | One async Server Component per route: loads its data, renders the feature's components | server | `news/screens/review-screen.tsx` |
| `components/` | React components, in role folders (§1.2.1) | server by default; client if marked | `portfolio/components/section/portfolio-section.tsx` |
| `actions/` | Server actions (`"use server"`) | server | `portfolio/actions/position-actions.ts` |
| `data/` | All database / network I/O for the feature | server only | `instruments/data/instrument-directory.ts` |
| `schemas/` | Zod contracts and the types derived from them | anywhere | `portfolio/schemas/portfolio.schema.ts` |
| `fixtures/` | Scaffolding data — delete when real data lands | anywhere | none at present |
| `index.ts` | Public API, **client-safe** | anywhere | |
| `server.ts` | Public API, **server-only** | server | |

#### 1.2.1 Component roles

Every components folder — a feature's `components/` and `src/shared/ui/` — groups its
components into subfolders by role. No component sits at the folder's root; in `shared/ui`,
only non-component modules do (`cn.ts`, `theme.*`). Like the directories above, a role name
means the same thing everywhere; do not invent a new one for something these cover.
**[review]**

| Role | Holds | Example |
| --- | --- | --- |
| `layout/` | Structure that places other components on the page | `shared/ui/layout/sidebar.tsx` |
| `navigation/` | Links and menus that move between screens | `shared/ui/navigation/nav-item.tsx` |
| `section/` | A titled region of a screen composing other roles | `portfolio/components/section/portfolio-section.tsx` |
| `card/` | A self-contained panel presenting one item | `news/components/card/article-feed-card.tsx` |
| `list/` | A collection and its empty state | `news/components/list/coverage-list.tsx` |
| `row/` | One entry of a list | `portfolio/components/row/position-row.tsx` |
| `form/` | A `<form>`, and controls bound to its submission | `shared/ui/form/submit-button.tsx` |
| `input/` | One labelled form control | `instruments/components/input/instrument-picker.tsx` |
| `display/` | Read-only atoms: icon, avatar, badge, chip, a line of text | `news/components/display/tonality-badge.tsx` |

A component's test sits next to it in the same role folder.

**One component per file.** No private sub-component declared beside the exported one: a
list's row is its own file under `row/`. Plain helper functions may share the file.
**[review]**

**A component lives in the feature that uses it.** `src/shared/ui` holds only basics that
more than one feature uses today (`Avatar`, `Icon`, the fields, `SubmitButton`, the app
shell). A screen's header, cards, lists and layout belong to its feature, even when they look
reusable. Do not build a generic wrapper to make that reuse possible — no polymorphic `as`
card, no list whose only job is to arrange slots. Write the specific component; it renders
its own markup. **[review]**

### 1.3 Dependency rules

Imports are **absolute everywhere** (`@/…`, mapped to `src/`), including inside a feature.
These rules are enforced by Biome's `noRestrictedImports`, so a violation fails CI instead of
surviving review.

1. **Features are imported through their entry points** — `@/features/news` or
   `@/features/news/server`, never `@/features/news/components/…`. **[lint]**
2. **`shared` is the bottom of the stack.** It may not import from `features` or `app`. If
   something in `shared` needs a feature, move the shared piece down or the feature-specific
   piece up. **[lint]**
3. **Features never import from `app`.** Routes compose features, not the reverse. **[lint]**
4. **Cross-feature dependencies form a DAG.**
   Most point at the foundation features `auth` and `instruments`: `portfolio → {auth, instruments}`, `news → instruments`.
   One edge joins two leaf features, agreed for the Review screen: `news → portfolio` (the screen reads the user's holdings).
   A new edge pointing the other way, or between two leaf features, is a design question to raise before writing it. **[review]**
5. **`tests/db/` reaches features only through `server.ts` or `index.ts`**, like any other consumer. **[lint]**

Because a feature's own files also import absolutely, each feature has an override in
`biome.jsonc` re-allowing its own internals. A new feature without one fails rule 1 on its
first internal import — deliberately, so the override is not forgotten.

**Relative imports.** There are exactly two places they are allowed:

- `src/shared/config/server-env.ts` reaches `./env` and `../logger` relatively, because
  `next.config.ts` loads it to validate the environment at build time and Next's config loader
  cannot resolve `@/` from a nested module. Anything `server-env.ts` imports must therefore
  also avoid `@/` — keep that module's import graph tiny.
- `tests/db/` imports its own helpers (`./helpers/seed`), which live outside `src/` and so
  have no alias.

Everywhere else, a relative import is a mistake. **[review]** CSS is not covered by the
alias: `globals.css` imports `../shared/ui/theme.css` relatively.

### 1.4 Client/server split

Each feature has two entry points:

- **`index.ts` is client-safe.**
  It exports components, schemas and types.
  It must never transitively import `server-env`, `@/shared/supabase/server`, `@/shared/supabase/admin`, or anything under `data/`.
- **`server.ts` is server-only.**
  It exports `data/` functions and the server actions that routes call directly (e.g. `signOut`).

Anything not re-exported from one of the two is internal to the feature. Export the type
alongside the value (`export { PortfolioSection, type PortfolioSectionProps }`) so consumers
never need to reach for a schema file.

Server actions are the one thing that crosses the line by design: a client component may
import an action from its own feature's `actions/` directory, because `"use server"` turns it
into a reference rather than bundling its body.

The same split exists in config:

| Module | Contains | Importable from |
| --- | --- | --- |
| `@/shared/config/env` → `clientEnv` | `NEXT_PUBLIC_*` only | anywhere |
| `@/shared/config/server-env` → `serverEnv` | secrets + everything public | server only — throws immediately if evaluated in a browser |

The `typeof window` guard in `server-env.ts` is the backstop that turns a leaked import into a
loud crash instead of a leaked secret. Do not remove it, and do not add a server-only module
that bypasses it: every `data/` module reaches either `server-env` or `next/headers`, which is
what makes an accidental client import fail.

And in Supabase clients — pick by *who the request is for*, not by convenience:

| Client | Use from | Auth | RLS |
| --- | --- | --- | --- |
| `createSupabaseBrowserClient` | client components | user session | applies |
| `createSupabaseServerClient` | RSC, route handlers, server actions | session from cookies | applies |
| `createSupabaseAdminClient` | background work (none today) | secret key | **bypassed** |

**The admin client is never reachable from a request made on a user's behalf.** Not from a
page, not from an action, not "just to read a shared table". If user-facing code needs data
RLS hides, the policy is wrong — change the policy. **[review]**

---

## 2. TypeScript

- **Strict, plus.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `verbatimModuleSyntax` are all on. Never loosen them locally. **[tsc]**
- **No `any`** **[lint]**, **no non-null assertions** outside tests **[lint]**.
  Indexed access returns `T | undefined`; handle it.
- **Type-only imports use `import type`** / inline `type` specifiers. **[lint]**
- **`node:` protocol** for Node built-ins (`node:crypto`, `node:fs/promises`). **[lint]**
- **`exactOptionalPropertyTypes`** means an optional prop that may receive `undefined` is
  written `next?: string | undefined` (see `SignInFormProps`). **[tsc]**
- **Props and parameter objects are `readonly`**; read models are returned as
  `readonly T[]`. **[review]**
- **Lookup tables are `as const` objects**, not TypeScript `enum`s (`VARIANTS`, `APPEARANCE`, `ROUTES`). **[review]**
- **Expected failure is a value, not an exception.**
  Use a discriminated union, `{ ok: true; value } | { ok: false; … }` (`ParseResult`) or `{ status: … }` (`FormState`).
  Throw only for the unexpected. **[review]**
- **Casts (`as`) only at an untyped third-party boundary** (test stubs).
  Never to silence a type error in our own code.
  If a value from outside needs a type, parse it with a schema. **[review]**
- TypeScript is pinned to 5.9. Do not bump the major without checking the Next type plugin.

## 3. Naming and files

- **Filenames are kebab-case** (`add-position-form.tsx`), except where Next reserves the name
  (`page.tsx`, `layout.tsx`). **[lint]**
- **Zod schema files end in `.schema.ts`**; tests sit next to their source as
  `<name>.test.ts(x)`. **[review]**
- **Schemas are `PascalCaseSchema`**, and their type is the same name without the suffix:
  `PositionSchema` / `type Position = z.infer<typeof PositionSchema>`. **[review]**
- **Components are PascalCase and export a `<Component>Props` type.** **[review]**
- **Module-level constants are `SCREAMING_SNAKE_CASE`** and carry the unit when it is not obvious: `LOOKUP_CHUNK`, `FEED_LIMIT`.
  No magic numbers inline. **[review]**
- **Data functions start with a verb that says what they cost**: `list*` / `get*` / `search*` for request-scoped reads, `fetch*` for external HTTP. **[review]**
- **Database columns are `snake_case`; domain objects are `camelCase`.**
  The conversion happens once, in `data/`.
  One deliberate exception keeps `snake_case`: seed schemas, which mirror table columns. **[review]**
- **Spelling.** Code identifiers use US spelling (`color`, `normalize`), matching the libraries.
  Prose, comments and docs use British spelling (`summarisation`, `colour`). **[review]**

## 4. Data at the boundary

- **Zod schemas are the single source of truth** for anything crossing the app's boundary: HTTP responses, form data, seed files, database rows on their way into the domain. **[review]**
- **Types are derived with `z.infer`, never hand-written alongside a schema.** **[review]**
- **Validate at the edge, then trust.**
  `data/` parses; everything downstream receives domain objects and never re-validates (see `news/data/feed-queries.ts`). **[review]**
- **Coerce once, at the schema.** Form fields arrive as strings; the schema turns them into
  numbers, `null`s and trimmed strings (`QuantitySchema`, `CostBasisSchema`). Dates become
  `Date` objects in the schema so nothing re-parses them. **[review]**
- **User-facing validation messages live in the schema** (`{ error: "Pick an instrument." }`),
  written as instructions to the user. **[review]**
- **Fixtures and test data are `.parse()`d, never cast**, so data that drifts from the
  contract fails loudly. **[review]**
- **Database row types come from `database.types.ts`** (`Pick<Database["public"]["Tables"]…>`),
  which is regenerated, never hand-edited. **[review]**
- **Never interpolate user input into a PostgREST filter string** (`.or("…")`, `.filter()`).
  Use the typed builders (`.eq`, `.ilike`, `.in`), which encode values, or a helper from
  `@/shared/supabase/postgrest` (`ilikeAny`) that quotes and escapes them. **[review]**

## 5. Environment

- **Every variable exists in three places:** `.env.example` (which variables, with a short comment
  saying what each one is and its accepted values), `env.ts` or `server-env.ts` (the shape),
  and a default in the schema when one is sensible. CI copies `.env.example` to `.env`, so
  drift breaks the build. **[test]**
- **Public variables** go in `env.ts` *and* in `clientRuntimeEnv` written out in full
  (`process.env.NEXT_PUBLIC_FOO`), because Next only inlines literal accesses. **[review]**
- **Code reads `serverEnv` / `clientEnv`, never `process.env`.**
  The only exceptions are the ones that must run before or without the parsed env: `instrumentation.ts` (`NEXT_RUNTIME`), `logger.ts` (`LOG_LEVEL`, read lazily), `parseEnv` (`SKIP_ENV_VALIDATION`). **[review]**
- **Required means required at boot.**
  A missing key fails `next build` and `register()`, not halfway through a request.
  Use `.optional()` only for things the app can genuinely run without, and log a `warn` when a feature is skipped because of it. **[review]**
- **Values that belong together are documented together.** **[review]**

## 6. Server code

### 6.1 Server actions

Follow `portfolio/actions/position-actions.ts`:

```ts
"use server";

export async function addThing(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(ThingInputSchema, formData);   // 1. validate first
  if (!parsed.ok) return parsed.state;

  const user = await requireUser();                       // 2. only if you need user.id
  const supabase = await createSupabaseServerClient();    // 3. session client, RLS applies

  const { error } = await supabase.from("things").insert({ … });
  if (error) return formError(friendlyMessage(error));    // 4. expected failures are values

  revalidatePath(ROUTES.things);                          // 5. path from the registry
  return { status: "success" };
}
```

- Signature is `(previous: FormState, formData: FormData) => Promise<FormState>` so it plugs
  into `useActionState`. Use `FormState`, `IDLE`, `formError` and `parseForm` from
  `@/shared/form-state` — do not define a per-feature state type. **[review]**
- **Never trust the client for ownership.** Do not filter by `user_id` in application code;
  RLS does it. Set `user_id` on insert from `requireUser()`, never from the form, and let the
  policy's `with check` verify it. **[review]** **[db]**
- **An update or delete that RLS hides matches zero rows; it does not error.** When the
  difference matters, `.select("id")` and check the length (`updatePosition`). **[review]**
- **Map known Postgres error codes to human messages** with a named constant
  (`DUPLICATE_KEY = "23505"`). Fall back to `error.message`. **[review]**
- Mutations `revalidatePath`; there is no client-side data fetching and no optimistic UI yet
  (see `docs/improvements.md`). **[review]**

### 6.2 Reads and repositories

- **Request-scoped reads** (`data/` behind `server.ts`) create their own
  `createSupabaseServerClient()` per call, select an explicit column list (never `*`), map
  `snake_case → camelCase`, and `.parse()` through the read-model schema. **[review]**
- **One row mapper per table, owned by its feature.** Any feature reading `instruments`
  selects `INSTRUMENT_COLUMNS` and maps with `toInstrument` from `@/features/instruments`,
  including inside joins (`instruments!inner(${INSTRUMENT_COLUMNS})`). **[review]**
- **A failed query throws** `new Error(\`Could not <verb> <thing>: ${error.message}\`)`.
  The route's error boundary handles it. **[review]**
- **Routes fetch in parallel** with `Promise.all` when reads are independent
  (`portfolio/page.tsx`). **[review]**
- **Count with `.select("id", { count: "exact" }).limit(0)`, not `head: true`.** A `HEAD`
  response has no body, so a failure reaches us with an empty message
  (`getHoldingCounts`). **[review]**
- **Chunk large `in.(…)` lookups** (`LOOKUP_CHUNK`) — PostgREST answers 414 on long URLs.
  **[review]**

### 6.3 Auth

- **Server code that needs a user calls `requireUser()`** from `@/features/auth/server`. It
  is the second line of defence behind `middleware.ts`, not a replacement for it. **[review]**
- **Revalidate the token with `getUser()`; never trust `getSession()`** server-side.
  **[review]**
- **Paths are never hand-written.** Add them to `ROUTES` in `@/shared/routes`; mark them in
  `PUBLIC_ROUTES` only if they must work signed out. `typedRoutes` catches typos in `href`s.
  **[tsc]**
- **Redirect targets from user input go through `safeRedirectPath()`** from
  `@/shared/routes`, and redirect to what it returns. `startsWith("/")` alone accepts
  `//evil.com`, which browsers treat as another origin. **[test]**

### 6.4 Logging

- **Use `logger` from `@/shared/logger`**, never `console.log` **[lint]**. `console.error` /
  `console.warn` are lint-allowed but `logger.error` / `logger.warn` are preferred, so every
  line is one parseable JSON object. **[review]**
- **Event names are dotted and stable**: `<feature>.<stage>[.<detail>]` in `snake_case`.
  Put variable data in fields, never in the event name. **[review]**
- **Never log a secret, a token or a full request URL that carries one.** **[review]**

## 7. React and UI

- **Server Components by default.** Add `"use client"` only to the leaf that needs state,
  effects, `useActionState` or `useFormStatus`. A section component composing client forms
  stays a Server Component (`portfolio-section.tsx`). **[review]**
- **Forms are progressive**: `<form action={formAction}>` with `useActionState(action, IDLE)`,
  submitted by `SubmitButton` (which handles the pending label via `useFormStatus`). Hidden
  inputs carry ids; `name="intent"` on the button carries the variant. **[review]**
- **Errors render as `<p role="alert" className="text-danger text-detail">`**. **[review]**
- **Use the `shared/ui` primitives** (`TextField`, `SelectField`, `SubmitButton`) rather than
  styling raw inputs. They wire `label`/`htmlFor`, `aria-describedby` and `aria-invalid` — a
  new primitive must do the same. **[review]**
- **A page only returns its screen.** `src/app/**/page.tsx` imports one `*Screen` from a
  feature's `server.ts` and returns it, passing `searchParams` through when the route has
  them (typed with Next's generated `PageProps<"/route">`). Data loading and markup live in
  the screen, under the feature's `screens/`. `src/app/pages.test.ts` checks every page file.
  **[test]**
- **Screens render inside the app shell.** `(app)/layout.tsx` composes `AppShell`, `Sidebar`
  and `NavItem`; a screen's root is a `<div>`, because the shell owns `<main>`. A new screen
  is a `NavItem` with an `href`; a planned one has `href={null}` and renders disabled.
  **[review]**
- **Icons are `lucide-react`, rendered through `Icon`** (`<Icon icon={Eye} />`), which sets
  size, stroke and `aria-hidden`. An icon never carries meaning alone; text beside it does.
  **[review]**
- **Every list has an explicit empty state**, never a blank card. **[review]**
- **Hooks follow the rules**; exhaustive dependencies are an error, and callbacks passed to
  children are stabilised with `useCallback`. **[lint]**
- **Formatting is deterministic across server and client.** `Intl` formatters fix both
  locale and `timeZone`, or React reports a hydration mismatch. **[review]**
- **External links** carry `rel="noreferrer"`. **[review]**

### 7.1 Theme and styling

- **Tailwind only**, no CSS modules. **No inline `style`** **[lint]** and **no arbitrary
  values** (`p-[13px]`, `bg-[#000]`) **[lint]**.
- **No values in components — only theme tokens.** Every colour, type size, radius, width
  and spacing role is declared once in `src/shared/ui/theme.css`, and components use the
  utilities it generates. Tailwind's default palette, type scale, line heights, tracking,
  radii and container widths are reset, so `text-gray-500`, `text-sm` or `rounded-md`
  render nothing. **[test]**
- **Every class must resolve.** `theme.test.ts` compiles the theme and fails on any utility
  in a component that generates no CSS — a stale token name or a reset default. **[test]**
- **Colours are scoped to the utility they serve**, so a misuse does not exist as a class:
  | Utility | Tokens |
  | --- | --- |
  | `bg-` | `canvas`, `surface`, `surface-raised`, `inverse`, `tone-{positive,neutral,negative}-tint`, `{warm,cool}-tint` |
  | `text-` | `primary`, `secondary`, `tertiary`, `inverse` |
  | `border-` | `hairline` |
  | any colour utility | `accent`, `danger`, `tone-positive`, `tone-neutral`, `tone-negative`, `warm`, `cool` |

  `bg-primary` and `text-surface` do not exist by design. **[test]**
- **`text-tertiary` is below WCAG AA for body text** (≈3.4:1 on canvas). Use it only for
  text that repeats information shown elsewhere — counts, separators. **[review]**
- **Tints are derived in the theme** (`color-mix` of the tone), never built in a component
  with an opacity modifier (`bg-accent/20`). **[review]**
- **Type is a role, not a size.** `text-display`, `text-title`, `text-heading`,
  `text-subheading`, `text-body`, `text-detail`, `text-label`, `text-caption`, `text-tag`,
  `text-overline` (uppercase labels, with `uppercase`) and `text-meta` (machine-like lines,
  with `font-mono uppercase`) each set size and line height, and weight and tracking where
  they differ. `font-*` may emphasise a word inside a role. **[test]**
- **Spacing: a role token for what the layout owns, Tailwind's scale inside a component.**
  Page gutter `px-gutter`, page padding `py-page`, between page sections `gap-section`,
  between cards or blocks `gap-stack`, card padding `p-card`, control padding
  `px-control-x py-control-y`, tag padding `px-tag-x py-tag-y`, side rail padding `px-rail-x`.
  Steps inside a component
  (`gap-2`, `mt-1`) use Tailwind's numeric scale, itself a token (multiples of `--spacing`).
  **[review]**
- **Sizes are tokens:** `w-sidebar`, `w-rail`, `max-w-content`, `max-w-narrow`, `min-w-field`,
  `size-icon`, `size-avatar`, `size-avatar-lg`, `rounded-card`, `rounded-control`,
  `rounded-tag`, `opacity-disabled`, `opacity-dimmed` (an empty entry kept for context).
  **[test]**
- **A new token** goes in `theme.css` under the narrowest namespace that uses it
  (`--background-color-*` before `--color-*`). A width (`--container-*`) never reuses a
  spacing name: `w-*`, `max-w-*` and `min-w-*` read `--spacing-*` first, so `w-rail` would
  silently take the rail's padding. A non-colour token is also added to
  `THEME_TOKENS` in `@/shared/ui/cn`. **[test]**
- **One dark theme; no `dark:` variants.** A second theme overrides the `theme.css`
  variables under a selector, never variants in markup. **[review]**
- **Class names are combined with `cn()`** from `@/shared/ui/cn`, never a template literal
  (`` `${base} ${variant}` ``). `cn` merges through tailwind-merge configured with our tokens,
  so a later class overrides a conflicting earlier one instead of both shipping. **[review]**
- **Variants are a typed lookup object** (`VARIANTS[variant]`, `STATES.active`) passed to
  `cn`, not string concatenation scattered through JSX. **[review]**
- **The browser `themeColor`** is `BROWSER_THEME_COLOR` from `@/shared/ui/theme`, kept equal
  to the canvas token. **[test]**

## 8. Database

- **The schema lives only in `supabase/migrations/`**, named
  `YYYYMMDDHHMMSS_<snake_case_description>.sql`. **Never edit a migration that has been
  applied**; write a new one. **[review]**
- **After any schema change, run `pnpm db:types`** and commit the regenerated
  `database.types.ts`. Never hand-edit it. **[review]**
- **Every new table needs all three:** `enable row level security`, a policy, and an explicit
  `grant`. Tables created by the migration role get no default privileges, so a missing grant
  is a `permission denied`, and a missing policy is an empty result. **[db]** **[test]**
- **Deny by default.** `anon` gets nothing. `authenticated` reads shared tables and owns its
  own rows. `service_role` writes shared tables. *No write policy is the write policy* for
  shared tables. **[db]**
- **Write `(select auth.uid())`, not `auth.uid()`**, in policies, so it is evaluated once per
  statement. **[review]**
- **Split `for all` policies** into per-verb policies when the verbs need different rules
  (`20260909120000_active_instrument_writes.sql`). **[review]**
- **Invariants belong in the database**: `check` constraints, unique indexes, foreign keys,
  `not null`. Application validation is for the user's benefit; the database is for
  correctness. Remember that foreign keys are checked *without* RLS — a rule like "only active
  instruments" must be spelled out in the policy. **[db]**
- **Naming**: constraints `<table>_<column>_<rule>` (`portfolio_positions_quantity_positive`),
  unique indexes `<table>_<column>_key`, other indexes `<table>_<columns>_idx`. Every mutable
  table has `created_at`, `updated_at` and the `set_updated_at` trigger. **[review]**
- **Use `numeric`, not `real`/`float`, for anything compared against a threshold** —
  `0.7::real >= 0.7` is false (`20260927120000_summarization.sql`). **[review]**
- **SQL follows the same comment rule as TypeScript** (§10): describe what a policy, constraint
  or index does; the reasoning goes in the ADR. **[review]**
- **RPCs that PostgREST cannot express** (e.g. `<=>` vector search) are granted to
  `service_role` only unless there is a reason otherwise. **[db]**
- **Seed files** are validated against a schema and parsed by a unit test. **[test]**

## 9. Testing

- **Unit tests are colocated** (`foo.ts` → `foo.test.ts`), run with `pnpm test`, and never
  touch Docker or the network. **[review]**
- **Default environment is jsdom.** A test that reaches `server-env` must declare
  `// @vitest-environment node` at the top. **[test]**
- **What must have a unit test:** every schema with refinements or transforms, every component with conditional rendering, every seed file. **[review]**
- **Database behaviour is tested against a real database** in `tests/db/` (`pnpm test:db`,
  needs `pnpm db:start`). A new table or policy gets tests proving the second user can
  neither read, update, delete nor impersonate the first, and that anonymous access is
  denied — through PostgREST, with real tokens. **[review]**
- **Assert what RLS actually does**: a hidden row comes back *empty*, not as an error.
  **[review]**
- **Test names describe behaviour, including the alternative rejected**: "renders an explicit empty state rather than a blank card". **[review]**
- **Test data is built through the schema** (`NewsArticleSchema.parse({ … })`), so test
  fixtures cannot drift from the contract either. **[review]**
- **Replace dependencies by injection, not module mocking** — pass a stub client to the
  factory. `vi.fn()` for the stub's methods is fine. **[review]**
- **Query by role and accessible name** in component tests (`getByRole("link", { name })`).
  **[review]**
- Colocated tests may import their own feature's internals; non-null assertions and
  `console` are allowed in tests. **[lint]**

## 10. Comments and documentation

- **Comments describe the code, to make it easier to read**: what a value is, what a block does, what a function returns.
  `/** The outlet's own standfirst. Not generated, and not a summary. */` is the shape. **[review]**
- **Comments do not argue for implementation choices.** No "deliberately", "on purpose",
  "we measured", alternatives considered, or the bug that led here. That reasoning goes in an
  ADR, `docs/improvements.md`, or the commit message, where it can be long without cluttering
  the code. **[review]**
- **Keep them short — but not absent.** One line is the norm. Write one wherever a reader
  would otherwise have to stop and work something out. **[review]**
- **Only comment what the code cannot say itself.** The meaning of a `null`, a contract a
  caller must know ("renders its own `<li>`"), a unit. Never restate a name, a prop, a slot or
  the JSX structure — `/** The navigation column: header on top, nav items, footer */` above
  `Sidebar({ header, footer, children })` adds nothing. If deleting the comment loses no
  information, delete it. **[review]**
- **Short JSDoc on public functions whose behaviour is not obvious from the signature** —
  one sentence saying what it does (`requireUser`, `updateSession`). **[review]**
- **Record numbers in the ADR when a decision came from measurement** (the 0.08 dedup
  threshold, the 260-character body average). **[review]**
- Existing comments that predate this rule are rewritten when their code is touched, not in
  bulk.
- **Each implementation phase gets an ADR** in `docs/adr/`, numbered, with a row in the
  index table. **[review]**
- **Deliberate shortcuts go in `docs/improvements.md`** under the feature's heading: what
  exists, what it should become, and what makes it worth doing. A `TODO` in code is not a
  substitute. **[review]**
- **The README describes behaviour a user or operator sees**; this file describes how to
  write code. Update whichever your change affects. **[review]**

## 11. Tooling and workflow

- **pnpm only**, with the version pinned in `packageManager`; Node from `.node-version`.
  CI installs with `--frozen-lockfile`. **[test]**
- **A dependency with a native build step** must be added to `pnpm.onlyBuiltDependencies`.
  **[review]**
- **Formatting is Biome's**: 2 spaces, 100 columns, double quotes, semicolons, trailing commas,
  sorted imports. Run `pnpm lint:fix`; do not hand-format. **[lint]**
- **Commits follow the repository's convention** in the root `CLAUDE.md`: `web/<topic>` scopes, with the topic named after the folder touched (`feat(web/news): …`), or `web` alone for several topics.
  Header ≤ 100 characters, subject not starting upper-case. **[commit]**
- **The root `pre-commit` hook runs Biome on staged web files**: a convenience, not a gate. CI runs lint, typecheck, test and build.

---

## Checklists

### Adding a feature

1. Create `src/features/<name>/` using only the directory names in §1.2.
2. Add `index.ts` (client-safe) and, if needed, `server.ts` (server-only).
3. Add the feature's override to `biome.jsonc`, copying an existing block and changing the
   name in both `includes` and the `!@/features/<name>/**` exclusion.
4. Check the new cross-feature imports keep the dependency graph acyclic (§1.3 rule 4).
5. Add a section to `docs/improvements.md` for its known gaps, and an ADR if it is a phase.

### Adding a table

1. New timestamped migration: table with constraints, `created_at`/`updated_at` + trigger,
   indexes named per §8.
2. `enable row level security`, policies with `(select auth.uid())`, explicit `grant`s.
3. `pnpm db:reset && pnpm db:types`; commit the regenerated types.
4. Add RLS cases to `tests/db/rls.test.ts`; run `pnpm test:db`.
5. Queries go in the owning feature's `data/`, exported through its `server.ts`.

### Adding an environment variable

1. Add it to `.env.example` with a short comment saying what it is.
2. Add it to `serverSchema` (secret) or `clientSchema` + `clientRuntimeEnv` (public).
3. If the db test suite needs it, give it a placeholder in `tests/db/setup.ts`.

---

## Known deviations

Places where the current code does not yet follow the rules above. Fix them when touching the
file; do not copy them.

None at present. Add an entry here rather than leaving a known violation undocumented.
