# Architecture decision records

One record per implementation phase: what was decided, why, and what it costs. Where a
decision was driven by measurement rather than judgement, the numbers are in the record.

| ADR | Phase | Decision |
| --- | --- | --- |
| [0001](0001-schema-and-data-model.md) | Schema & data model | Superseded by api [0004](../../../api/docs/adr/0004-database-and-migrations.md), [0006](../../../api/docs/adr/0006-instruments.md), [0009](../../../api/docs/adr/0009-portfolios.md) and [0010](../../../api/docs/adr/0010-news-ingestion.md). Shared articles and summaries, per-user holdings; cost model lives in the schema |
| [0002](0002-auth-and-rls.md) | Auth & RLS | Superseded by [0008](0008-auth-through-the-api.md) (auth) and [api 0005](../../../api/docs/adr/0005-authentication.md) (authorisation). Password auth; deny-by-default RLS with explicit grants, tested through real PostgREST |
| [0003](0003-instruments-and-portfolio.md) | Instruments & portfolio | Superseded by api [0006](../../../api/docs/adr/0006-instruments.md) and [0009](../../../api/docs/adr/0009-portfolios.md) (data) and [0009](0009-supabase-removed.md) (web conventions). Seeded universe behind one lookup module; active-instrument rule enforced by policy |
| [0004](0004-ingestion-pipeline.md) | Ingestion | Superseded by [api 0010](../../../api/docs/adr/0010-news-ingestion.md). Pure stages, two sources, near-duplicates kept with a canonical pointer |
| [0005](0005-summarization-and-tonality.md) | Summarisation | Superseded by [api 0010](../../../api/docs/adr/0010-news-ingestion.md). Tonality only — bodies are too short to summarise; versioned prompts in the row key |
| [0006](0006-home-feed.md) | Home feed | Polymorphic cards; provenance claims only what was generated; route composes the two features |
| [0007](0007-local-summarization-backend.md) | Summarisation (follow-up) | Superseded by [api 0011](../../../api/docs/adr/0011-local-llm-backend.md). One `Completion` contract; a `claude` CLI backend runs summarisation locally on a Claude subscription |
| [0008](0008-auth-through-the-api.md) | Auth through the API | Next as backend-for-frontend; tokens in its own cookies, refreshed only in `proxy.ts`, one refresh in flight per token; typed client generated from OpenAPI |
| [0009](0009-supabase-removed.md) | Supabase removed | The API is the only backend; the `(app)` route group and the routes registry carried over from 0003; building blocks kept without a data source |

Forward-looking work is not duplicated here — it lives in
[improvements.md](../improvements.md), grouped by feature.
