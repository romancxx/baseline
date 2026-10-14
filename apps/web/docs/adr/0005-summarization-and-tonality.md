# 5. Summarisation and tonality

- **Status:** accepted
- **Date:** 2026-09-27
- **Phase:** 5 — Summarization & tonality

## Context

The phase called for a 2–3 line summary plus a tonality label per article, generated once with
a cheap model.

## Decision

- **No summaries. Tonality, confidence and mentioned tickers only.** Measured before building:
  article bodies average **260 characters** — a headline plus one teaser sentence. A 2–3 line
  summary of that is longer than its input; the headline already is the summary.
  `summary_text` is nullable and stays null until fuller text exists. The column and its
  validation are in place for when it does.
- **Claude Haiku 4.5** (`claude-haiku-4-5`), $1/$5 per MTok. A nightly run is a few cents.
- **Forced JSON via `output_config.format`.** The API constrains the response shape, so there
  are no code fences to strip and no `"tonality": "slightly positive"` to parse.
- **Zod re-validates what the schema cannot express** — tickers that are really company names,
  symbols outside the universe — and a rejection triggers exactly **one** corrective retry
  carrying the reason. Then the row is skipped; the next run picks it up, since nothing was
  written.
- **Sequential with small concurrency, not the Batches API.** Batch is 50% cheaper, but the
  measured bill is ~$8/month against ~$4, and batch costs a polling state machine that must
  survive between workflow runs. Prompt caching cannot help either: the system prompt is ~300
  tokens, below the 512-token minimum cacheable prefix.
- **Only articles with a link of `MIN_MATCH_CONFIDENCE` (0.7)** are classified: Finnhub's
  per-symbol news and text mentions, not ETF bucket matches. Nothing publishes "SPY news", so
  those links are a proxy — ETFs need a real index-news source, not a lower threshold.
- **The prompt is versioned in code and the version is part of the row key.** Bumping
  `SUMMARY_PROMPT_VERSION` writes a new row instead of overwriting, so a prompt regression is
  comparable rather than merely noticeable. The runner warns when file and env disagree.
- **Token counts and cost are stored per row and logged per run.** Prices live in env beside
  `SUMMARY_MODEL`, because they belong to it.
- **`ANTHROPIC_API_KEY` is required**, so a missing key fails at boot rather than halfway
  through a nightly run.

## Evidence

The `>= 0.7` filter this phase depends on was silently broken: `article_instruments.confidence`
was `real`, which stores 0.7 as 0.69999998, so `confidence >= 0.7` was **false** for every row
storing 0.7. The column is now `numeric(3,2)` — the filter matches 848 links where it
previously matched 839, excluding every `rss-mention` article. A db test pins the boundary.

## Consequences

Tonality works on a headline, which is all the text there is. Swapping models or prompts is a
config change with old rows preserved for comparison.

## Known gaps

**Tonality is unevaluated** — no labelled set, so "is it any good" has no answer beyond reading
output. Per-instrument synthesis ("what happened to AAPL today") is probably the better product
and belongs in `digests.payload`. See [improvements.md](../improvements.md).
