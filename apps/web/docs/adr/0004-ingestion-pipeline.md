# 4. Ingestion pipeline

- **Status:** accepted
- **Date:** 2026-09-26
- **Phase:** 4 — Ingestion pipeline

## Context

Articles had to land nightly, deduped and mapped to instruments, from sources that answer
different questions: Finnhub knows about companies, RSS knows about the market.

## Decision

- **Pure stages, thin adapters.** `normalize`, `match` and `dedup` are pure and unit-tested;
  only the adapters and the repository do I/O. A new source is one file.
- **Feeds live in a table**, not a config file, so they can be changed without a deploy;
  `supabase/seed/feeds.json` only populates it.
- **Three matching rules, each recording its own `match_method` and confidence** — so a bad
  rule is findable in the data rather than invisible: `finnhub-symbol` (1.0, the symbol was
  the query), `rss-mention` (0.7, name or 3+ character ticker in the text), `rss-bucket` (0.5,
  arrived on a feed tagged with this instrument's bucket).
- **Two-letter tickers are excluded from text matching.** `V`, `MC`, `OR`, `KO` collide with
  ordinary words; they match by company name instead.
- **Near-duplicates are kept, not discarded**, with `canonical_article_id` pointing at the
  first copy. Provenance survives, nothing is re-embedded, and summarisation filters to
  `canonical_article_id is null`.
- **Embeddings run locally** — `bge-small-en-v1.5`, 384 dims, no API key and no per-article
  cost. `articles.embedding` was resized from 1536 while it was still empty.
- **Idempotency comes from unique indexes**, not bookkeeping: `url` and `content_hash` are
  unique and inserts use `ignoreDuplicates`.

## Evidence

Two things only a live run revealed:

- **A 414.** 51 URLs in one `or=` filter exceeded PostgREST's URI limit. The lookup is now
  chunked at 40, with a test that feeds it 95.
- **The dedup threshold cannot be tuned to be safe.** Over 403 real articles, "same story,
  different outlet" and "same stock, different story" both land at 0.10–0.14 cosine distance —
  a headline plus one sentence carries too little signal. At 0.17, a third of collapses were
  wrong (two different Cramer segments merged). `NEAR_DUPLICATE_DISTANCE` is therefore a tight
  **0.08**, catching only near-verbatim rewording. The errors are asymmetric: a false collapse
  means an article is never summarised and the story silently vanishes; a missed duplicate
  costs one repeated line.

## Consequences

Re-running a day is a verified no-op. ETF coverage is a proxy rather than evidence, which is
why summarisation skips it (see ADR 5).

## Known gaps

`rss-mention` fired 9 times in 941 articles — close to dead weight. Bodies average 260
characters. No index/market news source. See [improvements.md](../improvements.md).
