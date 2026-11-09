# Architecture decision records

One record per implementation phase: what was decided, why, and what it costs. Where a
decision was driven by measurement rather than judgement, the numbers are in the record.

| ADR | Phase | Decision |
| --- | --- | --- |
| [0001](0001-auth-through-the-api.md) | Auth through the API | Next as backend-for-frontend; tokens in its own cookies, refreshed only in `proxy.ts`, one refresh in flight per token; typed client generated from OpenAPI; signed-in pages in the `(app)` route group, paths in one registry |

The records from when the web app ran on Supabase were removed and numbering started again; they remain in the history at [`e476ac1`](https://github.com/romancxx/stock-news-v2/tree/e476ac1/apps/web/docs/adr).

Forward-looking work is not duplicated here — it lives in
[improvements.md](../improvements.md), grouped by feature.
