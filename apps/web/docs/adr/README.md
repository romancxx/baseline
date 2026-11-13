# Architecture decision records

One record per implementation phase: what was decided, why, and what it costs. Where a
decision was driven by measurement rather than judgement, the numbers are in the record.

| ADR | Phase | Decision |
| --- | --- | --- |
| [0001](0001-auth-through-the-api.md) | Auth through the API | Next as backend-for-frontend; tokens in its own cookies, refreshed only in `proxy.ts`, one refresh in flight per token; typed client generated from OpenAPI; signed-in pages in the `(app)` route group, paths in one registry |
| [0002](0002-visual-foundation-and-shell.md) | Visual foundation and shell | Contrast as the brand and six scoped hues; three typefaces; a top bar instead of the sidebar; search as a self-managed modal in `instruments`; sign-in modes in the URL, one form each; figures formatted from decimal strings |
| [0003](0003-holdings-search-and-instrument-page.md) | Holdings, search and the instrument page | Figures from the overview as sent; Recharts with the chart's one number; range in the URL; search through a cancellable route handler and "Load more" through an action; `/instruments/[id]` composed by `news`; null-on-404 reads; the as-of stamp removed |
| [0004](0004-csv-import.md) | CSV import | Upload, preview and confirm held in the browser, the same `File` sent twice; actions called by the flow; counts to Holdings in the address; the size limit mirrored from the API; uploads typed `Blob` |

The records from when the web app ran on Supabase were removed and numbering started again; they remain in the history at [`e476ac1`](https://github.com/romancxx/stock-news-v2/tree/e476ac1/apps/web/docs/adr).

Forward-looking work is not duplicated here — it lives in
[improvements.md](../improvements.md), grouped by feature.
