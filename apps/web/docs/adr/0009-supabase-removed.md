# 9. Supabase removed

- **Status:** accepted
- **Date:** 2026-11-09
- **Phase:** 9 — Supabase removed

## Context

Since [0008](0008-auth-through-the-api.md), users sign in through `apps/api`, and Review and Portfolio show "Being rebuilt" placeholders.
Nothing a route reached still read Supabase, yet the web app kept its packages, environment variables, migrations, seed file, a db test suite needing a local Supabase stack, and data modules no route called.
[0003](0003-instruments-and-portfolio.md) also recorded two web conventions that still hold beside its Supabase data model.

## Decision

- **`apps/api` is the web app's only backend.**
  The web app defines no schema, policy or seed data.
  Authorisation is tested in the API, which tests every user-owned endpoint with a second user ([api 0005](../../../api/docs/adr/0005-authentication.md)), so the web's db suite is gone rather than ported.
- **Signed-in pages live in the `(app)` route group** (from 0003).
  Its layout requires a user and carries the app shell and navigation, so `/sign-in` and `/session/expired`, outside the group, render without them.
- **Paths are written only in the routes registry** (from 0003).
  `ROUTES` holds every path, and `PUBLIC_ROUTES` is what `proxy.ts` lets through signed out.
- **Reads stay in Server Components and changes in server actions**, through the API client, as 0008 states.
- **The building blocks the rebuilt screens will adapt stay without a data source**: the news components, `PortfolioSection`, `InstrumentAvatar`, and the instrument, position, feed and tonality schemas.
  They compile against the web's own Zod types.
- **The position forms and the instrument picker are deleted.**
  The forms were bound to the Supabase actions they posted to, and a search combobox over the API replaces the picker's `<select>`.

## Consequences

Setting up the web app means running the API, then the web app; its environment is `NEXT_PUBLIC_APP_URL`, `API_BASE_URL` and `LOG_LEVEL`.
Positions entered in the Supabase database are not carried over to the API.
Review and Portfolio show placeholders until each is rebuilt on the API.

## Known gaps

[0006](0006-home-feed.md) still describes the feed's Supabase reads; the Review rebuild updates it.
