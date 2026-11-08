# Architecture decision records

One record per implementation phase: what was decided, why, and what it costs. Where a
decision was driven by measurement rather than judgement, the numbers are in the record.

| ADR | Phase | Decision |
| --- | --- | --- |
| [0001](0001-schema-and-data-model.md) | Schema & data model | Shared articles and summaries, per-user holdings; cost model lives in the schema |
| [0002](0002-auth-and-rls.md) | Auth & RLS | Password auth; deny-by-default RLS with explicit grants, tested through real PostgREST |
| [0003](0003-instruments-and-portfolio.md) | Instruments & portfolio | Seeded universe behind one lookup module; active-instrument rule enforced by policy |
| [0004](0004-ingestion-pipeline.md) | Ingestion | Superseded by [api 0010](../../../api/docs/adr/0010-news-ingestion.md). Pure stages, two sources, near-duplicates kept with a canonical pointer |
| [0005](0005-summarization-and-tonality.md) | Summarisation | Superseded by [api 0010](../../../api/docs/adr/0010-news-ingestion.md). Tonality only — bodies are too short to summarise; versioned prompts in the row key |
| [0006](0006-home-feed.md) | Home feed | Polymorphic cards; provenance claims only what was generated; route composes the two features |
| [0007](0007-local-summarization-backend.md) | Summarisation (follow-up) | Superseded by [api 0011](../../../api/docs/adr/0011-local-llm-backend.md). One `Completion` contract; a `claude` CLI backend runs summarisation locally on a Claude subscription |

Forward-looking work is not duplicated here — it lives in
[improvements.md](../improvements.md), grouped by feature.
