# Code standards

The rules every change to this codebase follows. They are derived from the code as it stands,
not from a style guide written in advance — where a rule exists, there is a file that already
does it right, and it is named.

Each rule is tagged with what holds it in place:

- **[lint]** Biome (`biome.jsonc`) — fails `pnpm lint` and CI.
- **[tsc]** TypeScript (`tsconfig.json`) — fails `pnpm typecheck` and CI.
- **[test]** A test fails if the rule is broken.
- **[commit]** The root `commit-msg` hook (`lefthook.yml`).
- **[review]** Convention only. Nothing catches it but a reader, so read for it.

`pnpm verify` runs everything CI runs except the build and the check that `api.types.ts` matches the API's schema.

---

## 1. Architecture

### 1.1 Layers

```
src/
  app/                  routes only — each page returns one feature screen
  features/<name>/      one vertical slice per feature
  shared/               the bottom of the stack: config, clients, UI primitives, utilities
  types/                type declarations, at the bottom of the stack beside shared/
  proxy.ts              request ID, session refresh, auth redirect
  instrumentation.ts    validates the server env at boot
```

Folders follow **features**, not file types. Adding a feature means adding a directory, not
touching six shared ones.

### 1.2 Feature directory vocabulary

A feature only has the directories it needs, but a directory's name always means the same
thing. Do not invent a new name for something one of these already covers.

| Directory | Holds | Runs on | Example |
| --- | --- | --- | --- |
| `screens/` | One async Server Component per route: loads its data, renders the feature's components; a region that streams under `Suspense` is an async component loading its own | server | `auth/screens/sign-in-screen.tsx`, `news/screens/instrument-screen.tsx` |
| `components/` | React components, in role folders (§1.2.1) | server by default; client if marked | `news/components/card/brief-card.tsx` |
| `actions/` | Server actions (`"use server"`) | server | `auth/actions/auth-actions.ts` |
| `data/` | All API reads for the feature | server only | `auth/data/current-user.ts` |
| `schemas/` | Zod contracts and the types derived from them | anywhere | `auth/schemas/credentials.schema.ts` |
| `utils/` | Pure functions over the feature's domain types: text to show, facts derived from a read model | anywhere | `portfolio/utils/holdings.ts` |
| `hooks/` | React hooks holding a client component's state and effects | client | `instruments/hooks/use-security-search.ts` |
| `fixtures/` | Scaffolding data — delete when real data lands | anywhere | none at present |
| `index.ts` | Public API, **client-safe** | anywhere | |
| `server.ts` | Public API, **server-only** | server | |

#### 1.2.1 Component roles

Every components folder — a feature's `components/` and `src/shared/ui/` — groups its
components into subfolders by role.
No component sits at the folder's root; only non-component modules do, such as class tables shared across roles (`shared/ui/button-styles.ts`, `portfolio/components/holdings-columns.ts`) and, in `shared/ui`, `cn.ts` and `theme.*`. Like the directories above, a role name
means the same thing everywhere; do not invent a new one for something these cover.
**[review]**

| Role | Holds | Example |
| --- | --- | --- |
| `layout/` | Structure that places other components on the page | `shared/ui/layout/top-bar.tsx` |
| `navigation/` | Links, menus and dialogs that move between screens | `shared/ui/navigation/nav-link.tsx` |
| `section/` | A titled region of a screen composing other roles | `portfolio/components/section/holdings-header.tsx` |
| `card/` | A self-contained panel presenting one item | `news/components/card/brief-card.tsx` |
| `list/` | A collection and its empty state | `news/components/list/instrument-news-list.tsx` |
| `row/` | One entry of a list | `news/components/row/news-row.tsx` |
| `form/` | A `<form>`, and controls bound to its submission | `shared/ui/form/submit-button.tsx` |
| `input/` | One labelled form control | `shared/ui/input/text-field.tsx` |
| `display/` | Read-only atoms: icon, avatar, badge, chip, a line of text | `news/components/display/tone-chip.tsx` |

A component's test sits next to it in the same role folder.

**One component per file.** No private sub-component declared beside the exported one: a
list's row is its own file under `row/`. Plain helper functions may share the file.
**[review]**

**A component lives in the feature that uses it.**
`src/shared/ui` holds two kinds of component.
One is the basics more than one feature uses today: `Avatar`, `Icon`, the fields, the app shell.
The other is the design system's primitives, which the design assigns to several screens and which are built before their second consumer: the buttons, `Card`, `Notice`, `Skeleton`, `PriceChange`, `FormError`, and the formatters in `@/shared/format`.
A screen's header, cards, lists and layout belong to its feature, even when they look reusable.
Do not build a generic wrapper to make that reuse possible — no polymorphic `as` card, no list whose only job is to arrange slots.
`Card` is one fixed element with an optional title, not a wrapper with slots.
Write the specific component; it renders its own markup. **[review]**

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
   Both leaf features point at the foundation feature `instruments`: `portfolio → instruments`, `news → instruments`.
   One edge joins two leaf features, `news → portfolio`: the instrument screen, in `news`, composes the header and chart from `instruments` and the position card from `portfolio`, and Home composes the Holdings card, the missing-prices notice and the empty state from `portfolio` the same way.
   A new edge pointing the other way, or between two other leaf features, is a design question to raise before writing it. **[review]**
5. **`types` sits at the bottom beside `shared`.** It may not import from `features` or `app`; it may import types from `shared` (a schema's `z.infer`, the generated API types). **[lint]**

Because a feature's own files also import absolutely, each feature has an override in
`biome.jsonc` re-allowing its own internals. A new feature without one fails rule 1 on its
first internal import — deliberately, so the override is not forgotten.

**Relative imports** are allowed in one place only.
`src/shared/config/server-env.ts` reaches `./env` and `../logger` relatively, because `next.config.ts` loads it to validate the environment at build time and Next's config loader cannot resolve `@/` from a nested module.
Anything `server-env.ts` imports must therefore also avoid `@/`, so keep that module's import graph tiny.
A type-only import (`import type`) is erased before the loader runs, so `logger.ts` may take its types from `@/types/logger`.

Everywhere else, a relative import is a mistake. **[review]** CSS is not covered by the
alias: `globals.css` imports `../shared/ui/theme.css` relatively.

### 1.4 Client/server split

Each feature has two entry points:

- **`index.ts` is client-safe.**
  It exports components, schemas and types.
  It must never transitively import `server-env`, `@/shared/api/*`, `@/shared/session`, or anything under `data/`.
- **`server.ts` is server-only.**
  It exports `data/` functions, the server actions that routes and screens pass on (e.g. `signOut`), and async components that load their own data for another feature's screen (`PriceChartCard`).

Anything not re-exported from one of the two is internal to the feature.
Export the type alongside the value (`export { InstrumentAvatar, type InstrumentAvatarProps }`) so consumers never need to reach for a schema file.

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

The API is reached only from the server, through `@/shared/api` (`api` with `dataOrThrow`, `dataOrNull` or `resultOf`; `createApiClient` for `session.ts`), and the session only through `@/shared/session`.
Both reach `server-env`, so a client import fails loudly. **[review]**

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
- **Types live in `src/types/`, one file per module, named after it**: `@/types/api` for the API client, `@/types/session`, `@/types/auth`.
  An implementation file declares no `type` or `interface`, exported or not, and no inline object type in a signature; it imports them.
  Two exceptions stay where they are: a component's `<Component>Props`, beside its component, and a type inferred from a schema (`z.infer`), in its `.schema.ts`.
  Files written before this rule move their types when they are next touched. **[review]**
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

- **Filenames are kebab-case** (`sign-in-form.tsx`), except where Next reserves the name (`page.tsx`, `layout.tsx`). **[lint]**
- **Zod schema files end in `.schema.ts`**; tests sit next to their source as
  `<name>.test.ts(x)`. **[review]**
- **Schemas are `PascalCaseSchema`**, and their type is the same name without the suffix: `SecuritySearchSchema` / `type SecuritySearch = z.infer<typeof SecuritySearchSchema>`. **[review]**
- **Components are PascalCase and export a `<Component>Props` type.** **[review]**
- **Module-level constants are `SCREAMING_SNAKE_CASE`** and carry the unit when it is not obvious: `LOW_CONFIDENCE`, `RENEWAL_REUSE_MS`.
  No magic numbers inline. **[review]**
- **Data functions start with a verb that says what they cost**: `list*` / `get*` / `search*` for request-scoped reads, `fetch*` for external HTTP. **[review]**
- **API fields are `snake_case`; domain objects are `camelCase`.**
  The conversion happens once, in `data/`. **[review]**
- **Spelling.** Code identifiers use US spelling (`color`, `normalize`), matching the libraries.
  Prose, comments and docs use British spelling (`summarisation`, `colour`). **[review]**

## 4. Data at the boundary

- **Zod schemas are the single source of truth** for anything crossing the app's boundary: HTTP responses and form data. **[review]**
  The API is the exception, below.
- **API responses are typed, not parsed.**
  Paths, parameters, bodies and responses come from `src/shared/api/api.types.ts`, generated by `pnpm api:types` from `apps/api/openapi.json` and never hand-edited, so a call the API does not accept fails `tsc` **[tsc]**.
  `data/` maps a response to a camelCase domain object; decimal strings stay strings. **[review]**
  The API's error body is the one thing parsed, by `ApiErrorBodySchema`, because the OpenAPI schema does not describe it. **[test]**
- **Types are derived with `z.infer`, never hand-written alongside a schema.** **[review]**
- **Validate at the edge, then trust.**
  Actions parse their form data with `parseForm`, `data/` maps API responses; everything downstream receives domain objects and never re-validates. **[review]**
- **Coerce once, at the schema.** Form fields arrive as strings; the schema turns them into `null`s and trimmed strings.
  A figure is checked by pattern and stays a decimal string, never a number (§7).
  Dates become `Date` objects in the schema so nothing re-parses them. **[review]**
- **User-facing validation messages live in the schema** (`{ error: "Enter a valid email address." }`), written as instructions to the user. **[review]**
- **Fixtures and test data are `.parse()`d, never cast**, so data that drifts from the
  contract fails loudly. **[review]**

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

Follow `auth/actions/auth-actions.ts`:

```ts
"use server";

export async function addThing(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(ThingInputSchema, formData);   // 1. validate first
  if (!parsed.ok) return parsed.state;

  const result = await resultOf(                          // 2. the session's token; a 401 signs out
    api.POST("/api/v1/things", { body: parsed.value }),
  );
  if (!result.ok) {                                       // 3. expected failures are values
    if (result.error.code === THING_TAKEN) return formError("This thing already exists");
    return formError("Could not add the thing. Try again.");
  }

  revalidatePath(ROUTES.things);                          // 4. path from the registry
  return { status: "success" };
}
```

- Signature is `(previous: FormState, formData: FormData) => Promise<FormState>` so it plugs
  into `useActionState`.
  Use `IDLE`, `formError` and `parseForm` from `@/shared/form-state`, and `FormState` from `@/types/form-state` — do not define a per-feature state type. **[review]**
- **Call the API with `api` and pass the call to `resultOf`**, both from `@/shared/api/request`: `api` sends the session's access token and the request's ID, and `resultOf` on a 401 clears the session and redirects to `/sign-in`.
  Any other failure comes back as an `ApiError`. **[review]**
- **Branch on the API's `code`, never its message**, with a named constant (`EMAIL_TAKEN = "email_taken"`).
  Any other failure gets a generic message and a `warn` log with the request ID. **[review]**
- Mutations `revalidatePath`; there is no optimistic UI. **[review]**
- **Data reaches the browser through server rendering**, with three exceptions ([ADR 0003](docs/adr/0003-holdings-search-and-instrument-page.md), [ADR 0004](docs/adr/0004-csv-import.md)).
  Search: `useSecuritySearch` fetches the `/search` route handler while the user types, so a newer query can cancel the one in flight, which a server action cannot; the answer is parsed with `SecuritySearchSchema`, since it crosses the network.
  "Load more": `loadMoreNews` is a server action returning the next page, which `InstrumentNewsList` appends to the first, rendered on the server.
  The CSV import: `previewImport` and `confirmImport` are server actions `useImportFlow` calls with the chosen `File`, not bound to a form, because the preview returns the dry run's report and the confirm sends the same `File` again. **[review]**

### 6.2 Reads and repositories

- **A read from the API goes through `dataOrThrow("<verb> <thing>", api.GET(…))`** from `@/shared/api/request`.
  It throws `Could not <verb> <thing>: …` for the route's error boundary, and redirects a 401 to `/session/expired`, which clears the cookies a Server Component cannot.
  A read whose absence the screen shows, such as a missing instrument or no brief yet, goes through `dataOrNull` instead: the same, but `null` on a 404 `not_found`.
  Wrap a read several components need in React `cache()`, so one request makes one call (`getCurrentUser`). **[review]**
- **Screens fetch in parallel** with `Promise.all` when reads are independent. **[review]**

### 6.3 Auth

- **Server code that needs a user calls `requireUser()`** from `@/features/auth/server`, which reads `GET /users/me` once per request.
  It is the second line of defence behind `proxy.ts`, not a replacement for it. **[review]**
- **Only `proxy.ts` refreshes the session**, before rendering; nothing else calls `refreshSession`.
  Session cookies are read, written and cleared only through `@/shared/session`, never by name. **[review]**
- **`proxy.ts` decides "signed in" from the cookies alone**, after refreshing if needed; it never calls the API to check.
  The first API call of the page is the authoritative check. **[test]**
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
- **A line about an API call carries the request's ID as `requestId`**, with the status and the API's code: `currentRequestId()` from `@/shared/api/request`. **[review]**

## 7. React and UI

- **Server Components by default.** Add `"use client"` only to the leaf that needs state, effects, `useActionState` or `useFormStatus`.
  A component composing client components stays a Server Component (`sign-in-screen.tsx`, around `SignInForm`). **[review]**
- **Components are markup.** Text built from data, and facts derived from it, come from a function in the feature's `utils/` (`holdingsSummary`, `pricedCount`); a component calls it, or calls a `@/shared/format` formatter directly. **[review]**
- **Forms are progressive**: `<form action={formAction}>` with `useActionState(action, IDLE)`, submitted by `SubmitButton` (which handles the pending label via `useFormStatus`).
  Hidden inputs carry ids. **[review]**
- **One form, one action.** A screen offering two submissions renders two forms, each with its own `useActionState` (`SignInForm` and `CreateAccountForm`), so a form posted without JavaScript posts one action. **[review]**
- **A form's error renders through `FormError`** under its fields; a message about the screen, such as a failed load or partial data, is a `Notice`. **[review]**
- **Use the `shared/ui` primitives** (`TextField`, `Button`, `ButtonLink`, `SubmitButton`) rather than styling raw inputs.
  They wire `label`/`htmlFor`, and `aria-describedby` to a hint — a new primitive must do the same. **[review]**
- **A page only returns its screen.** `src/app/**/page.tsx` imports one `*Screen` from a feature's `server.ts` and returns it, passing `params` and `searchParams` through when the route has them (typed with Next's generated `PageProps<"/route">`).
  Data loading and markup live in the screen, under the feature's `screens/`.
  `src/app/pages.test.ts` checks every page file. **[test]**
- **A route handler is a page that answers data**: it calls one function from a feature's `server.ts` and returns what it gives (`(app)/search/route.ts`), and its path is in `ROUTES`. **[review]**
- **Screens render inside the app shell.**
  `(app)/layout.tsx` composes `AppShell` and `TopBar`, filled with the `NavLink`s, the search and the account menu; a screen's root is a `<div>`, because the shell owns `<main>`.
  The bar holds Home and Holdings only: a screen reached from a holding, a brief or search, like an instrument page, gets no `NavLink`, and nothing renders disabled. **[review]**
- **Icons are `lucide-react`, rendered through `Icon`** (`<Icon icon={Eye} />`), which sets size, stroke and `aria-hidden`.
  An icon never carries meaning alone; text beside it does.
  The one exception is `ToneChip`'s glyphs, inline SVGs drawn for the four tones, which have no lucide equivalent. **[review]**
- **Figures go through `@/shared/format`** (`formatMoney`, `formatQuantity`, `formatPercent`) or `PriceChange`, from the API's decimal strings.
  The web app never turns a figure into a JavaScript number or does arithmetic on one.
  The one exception is the price chart, which turns a close into a number for its y coordinate only (`chartPoints`); its axis and tooltip format the decimal string. **[review]**
- **Dates go through `formatDate` and `formatTime`** from `@/shared/format`, read in UTC like every other formatter. **[review]**
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
- **The brand is one green, and six hues carry meaning.**
  The `brand` green marks the logo, the primary button and the price line; avatars stay neutral, and it is not used for gains (that is `up`).
  `up` and `down` are price movement, as bare text only; the four `tone-*` hues are news tone, as chips only.
  Nothing else on screen is coloured: an error uses the down hue as `danger`, partial data the amber of `tone-negative`, a success stays neutral. **[review]**
- **Colours are scoped to the utility they serve**, so a misuse does not exist as a class:
  | Utility | Tokens |
  | --- | --- |
  | `bg-` | `canvas`, `surface`, `surface-raised`, `surface-high`, `popover`, `scrim`, `brand`, `tone-{positive,negative,neutral,mixed}-tint`, `{danger,partial,success}-tint` |
  | `text-` | `primary`, `secondary`, `tertiary`, `inverse`, `brand`, `up`, `down`, `tone-{positive,negative,neutral,mixed}`, `danger`, `partial` |
  | `border-` | `hairline`, `hairline-strong`, `focus`, `danger`, `{danger,partial,success}-muted` |
  | `outline-`, `ring-` | `focus` |

  `bg-primary`, `text-surface` and `bg-up` do not exist by design. **[test]**
- **`text-tertiary` passes WCAG AA for body text** (≈5.7:1 on canvas, ≈5.3:1 on a surface), but reads as quiet.
  Use it for labels, hints and text that repeats information shown elsewhere. **[review]**
- **Tints are derived in the theme** (`color-mix` of the hue), never built in a component with an opacity modifier (`bg-tone-positive/20`). **[review]**
- **Three typefaces, three jobs.** `font-sans` (Inter, the default) for the interface, `font-mono` (JetBrains Mono) for figures, tickers and provenance, `font-serif` (Newsreader) for brief prose and the sign-in headline.
  All three load through `next/font` in the root layout. **[review]**
- **Type is a role, not a size.**
  `text-display` (large figures, with `font-mono`), `text-headline` (with `font-serif`), `text-title`, `text-heading`, `text-subheading`, `text-brief` (brief prose, with `font-serif`), `text-body`, `text-detail`, `text-label`, `text-caption`, `text-tag`, `text-overline` (uppercase labels, with `uppercase`) and `text-meta` (machine-like lines, with `font-mono uppercase`) each set size and line height, and weight and tracking where they differ.
  `font-*` may emphasise a word inside a role. **[test]**
- **Spacing: a role token for what the layout owns, Tailwind's scale inside a component.**
  Page gutter `px-gutter`, page padding `py-page`, between page sections `gap-section`,
  between cards or blocks `gap-stack`, card padding `p-card`, control padding
  `px-control-x py-control-y`, tag padding `px-tag-x py-tag-y`, side rail padding `px-rail-x`.
  Steps inside a component
  (`gap-2`, `mt-1`) use Tailwind's numeric scale, itself a token (multiples of `--spacing`).
  **[review]**
- **Sizes are tokens.**
  Heights and sizes: `h-bar` (the top bar), `min-h-control` (a field), `min-h-button`, `min-h-button-sm`, `size-icon`, `size-glyph`, `size-avatar-sm`, `size-avatar`, `size-avatar-lg`, `h-chart` (the price chart), `max-h-results` (search results before they scroll), `h-placeholder` (a card's loading placeholder).
  Widths: `w-rail`, `max-w-content`, `max-w-auth`, `max-w-search`, `w-menu`, `w-dialog`, `max-w-prose` (74 characters of brief).
  Radii: `rounded-tag`, `rounded-control`, `rounded-avatar`, `rounded-menu`, `rounded-card`, `rounded-pill`.
  Opacity: `opacity-disabled`, `opacity-dimmed` (an empty entry kept for context). **[test]**
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

## 8. Testing

- **Unit tests are colocated** (`foo.ts` → `foo.test.ts`), run with `pnpm test`, and never
  touch Docker or the network. **[review]**
- **Default environment is jsdom.** A test that reaches `server-env` must declare
  `// @vitest-environment node` at the top. **[test]**
- **Test names describe behaviour, including the alternative rejected**: "says no holding is priced yet rather than showing an empty card". **[review]**
- **Test data is built through the schema** (`SecuritySearchSchema.parse({ … })`), so test fixtures cannot drift from the contract either. **[review]**
- **Replace dependencies by injection, not module mocking** — pass a stub client to the
  factory. `vi.fn()` for the stub's methods is fine. **[review]**
- **Code that reaches the API is tested against `fakeApi`** from `@/shared/api/fake-api`, which replaces the global `fetch`, answers by method and path and records each request.
  Next's request-scoped modules (`next/headers`, `next/navigation`), which take no injection, are mocked with `vi.mock`; so is the API client in the auth action tests. **[review]**
- **Query by role and accessible name** in component tests (`getByRole("link", { name })`).
  **[review]**
- Colocated tests may import their own feature's internals; non-null assertions and
  `console` are allowed in tests. **[lint]**

## 9. Comments and documentation

- **Comments describe the code, to make it easier to read**: what a value is, what a block does, what a function returns.
  `/** A count from Holdings' query string; missing or malformed is zero. */` is the shape. **[review]**
- **Comments do not argue for implementation choices.** No "deliberately", "on purpose",
  "we measured", alternatives considered, or the bug that led here. That reasoning goes in an
  ADR, `docs/improvements.md`, or the commit message, where it can be long without cluttering
  the code. **[review]**
- **Keep them short — but not absent.** One line is the norm. Write one wherever a reader
  would otherwise have to stop and work something out. **[review]**
- **Only comment what the code cannot say itself.**
  The meaning of a `null`, a contract a caller must know ("renders its own `<li>`"), a unit.
  Never restate a name, a prop, a slot or the JSX structure — `/** The bar: logo and links on the left, account on the right */` above `TopBar({ navigation, search, account })` adds nothing.
  If deleting the comment loses no information, delete it. **[review]**
- **Short JSDoc on public functions whose behaviour is not obvious from the signature** — one sentence saying what it does (`requireUser`, `refreshSession`). **[review]**
- **Record numbers in the ADR when a decision came from measurement** (the 0.08 dedup
  threshold, the 260-character body average). **[review]**
- Existing comments that predate this rule are rewritten when their code is touched, not in
  bulk.
- **Each implementation phase gets an ADR** in `docs/adr/`, numbered, with a row in the
  index table. **[review]**
- **Deliberate shortcuts go in `docs/improvements.md`** under the feature's heading: what
  exists, what it should become, and what makes it worth doing. A `TODO` in code is not a
  substitute. **[review]**
- **The README is for running the app**: setup, scripts, environment and a map of the code.
  What a screen does and why goes in its phase's ADR, not the README; this file describes how to write code. **[review]**

## 10. Tooling and workflow

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

### Adding an environment variable

1. Add it to `.env.example` with a short comment saying what it is.
2. Add it to `serverSchema` (secret) or `clientSchema` + `clientRuntimeEnv` (public).

---

## Known deviations

Places where the current code does not yet follow the rules above. Fix them when touching the
file; do not copy them.

None at present. Add an entry here rather than leaving a known violation undocumented.
