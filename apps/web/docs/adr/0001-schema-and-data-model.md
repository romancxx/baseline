# 1. Schema and data model

- **Status:** Superseded by [api 0004](../../../api/docs/adr/0004-database-and-migrations.md), [0006](../../../api/docs/adr/0006-instruments.md), [0009](../../../api/docs/adr/0009-portfolios.md) and [0010](../../../api/docs/adr/0010-news-ingestion.md)
- **Date:** 2026-08-26
- **Phase:** 1 — Supabase setup & data model

## Context

Seven tables to design before any data existed. The cost model is the constraint: an article
is fetched once and summarised once, then read by every user it is relevant to. Getting that
wrong means per-user LLM calls.

## Decision

- **Shared vs per-user is a schema property, not a query convention.** `articles`,
  `summaries`, `article_instruments` and `instruments` are shared; only
  `portfolio_positions` and `digests` carry a `user_id`.
- **`uuid` primary keys** via `gen_random_uuid()`. Bigint identity leaks row counts.
- **Postgres enums** for `instrument_type`, `tonality`, `digest_period` — they surface as
  TypeScript unions in the generated types. `macro_bucket` stays free text: the taxonomy will
  churn.
- **`articles.content_hash` is unique**, so ingest is `on conflict do nothing` and the same
  wire story syndicated to five outlets is summarised once.
- **`summaries` is keyed on `(article_id, model, prompt_version)`.** Beyond the spec, but
  re-running a rewritten prompt otherwise either overwrites history or duplicates silently.
- **`digests` gained `period_start`.** The spec had only `generated_at`, which cannot express
  "the daily for 24 August", so reruns would duplicate.
- **`instruments` rows are deactivated, never deleted** — hence `on delete restrict` from
  user tables and `on delete cascade` from `auth.users`.
- **pgvector enabled and `articles.embedding` added while unused**, to avoid a backfill.
- **`numeric(24,8)` for quantities.** Money never touches float.

## Consequences

Summarisation cost is bounded by article count, not article × user count. Adding a second
user costs nothing in LLM spend. The cost is that every query touching a user's articles
joins through `article_instruments`.

## Known gaps

`isin` is null across the seeded universe — a ticker is not a global identity. See
[improvements.md](../improvements.md).
