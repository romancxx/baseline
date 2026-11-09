# 3. Instruments and portfolio CRUD

- **Status:** Superseded by [api 0006](../../../api/docs/adr/0006-instruments.md) and [api 0009](../../../api/docs/adr/0009-portfolios.md) (data), and by [web 0009](0009-supabase-removed.md) (web conventions)
- **Date:** 2026-09-10
- **Phase:** 3 — Instruments & portfolio CRUD

## Context

A real portfolio had to be enterable, over a universe that will eventually come from a
directory API rather than a hand-written file.

## Decision

- **Seed file is the catalogue source, not a runtime dependency.**
  `supabase/seed/instruments.json` (38 rows) is Zod-validated and upserted **on `ticker`**, so
  re-seeding edits in place instead of inserting duplicates. `active` is never overwritten.
- **Lookup lives in one module**, `instruments/data/instrument-directory.ts`. Swapping in EODHD
  or ESMA FIRDS changes what *fills* the table, not what reads it.
- **Users pick from the seeded universe only** — and that is enforced in the database. Foreign
  keys are checked *without* RLS, so an inactive instrument was still referenceable by a
  hand-made request. `20260909120000_active_instrument_writes.sql` splits the blanket
  `for all` policy so INSERT can require `active` while UPDATE cannot — a position stays
  editable after its instrument is deactivated.
- **Reads are RSC, mutations are server actions** with `revalidatePath`. No client fetching.
- **One page** (`/portfolio`), inside an `(app)` route group whose layout carries the nav, so `/sign-in` stays chrome-free.
- **Routes are centralised** in `src/shared/routes.ts`; no hand-written path strings.
- **Form numbers are coerced by Zod at the action boundary**, empty cost basis becomes null.

## Consequences

An unknown ticker cannot be added through the UI — it requires editing the JSON and
re-seeding. Deliberate while the universe is curated; wrong once a directory API lands.

## Known gaps

No optimistic UI (mutations round-trip), no inline validation, `searchInstruments` is written
but unused — the picker is a plain `<select>`, fine at 38 instruments and wrong at 3,000.
