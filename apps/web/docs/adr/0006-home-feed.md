# 6. Home feed

- **Status:** accepted
- **Date:** 2026-10-04
- **Phase:** 6 — Home feed

## Context

The dashboard had to show what happened to the user's holdings and watchlist, with provenance
on every card and a disclaimer, built so theme cards can join the same feed later.

## Decision

- **No generated summary on the card.** `summary_text` is null by ADR 5, so the body is the
  outlet's own teaser (`articles.raw_content`), labelled as such.
- **The provenance line states only what was produced.** "Headline and teaser from {source},
  published {stamp} · tonality by {model}, {stamp}", and "not yet classified" when no summary
  exists. The spec's "Generated from {source}" would claim generation that did not happen.
- **The route resolves the user's instruments, not the feed.** `page.tsx` calls
  `portfolio/server` and passes `FeedInstrument[]` into `listFeed`, avoiding a
  `news → portfolio` edge and keeping one owner per table. The only new edge is
  `news → summarization`, for `TonalityBadge`, pointing at the feature that owns tonality.
- **Cards are a discriminated union on `kind`.** `FeedItemSchema` has one member today;
  `FeedCard` switches on it and `CardShell` owns the shared chrome. A theme card is a new
  member plus a renderer, with no change to the feed.
- **One card per article**, listing every matched instrument the caller asked about. The
  mapper reports only the instruments passed in, not every match on the row.
- **Holdings and watchlist differ by existing tokens** — a filled chip against an outlined
  `· watching` one. A new colour would mean the three-place `globals.css` change.
- **Two empty states**, because "you own nothing yet" and "nothing published today" need
  different answers.
- **`listFeedWith(reader, query)` exists alongside `listFeed(query)`** so the db suite can
  drive the real query as a real signed-in user instead of mocking `next/headers`.
- **The unused news-API scaffolding was deleted** — gateway, fixtures, article schema, and the
  `NEWS_API_*` variables from env, CI and test setup.

## Evidence

Checked against the live corpus (941 articles, 5 cards for a user holding AAPL and MSFT):
everything rendered, and the matching noise became visible. Finnhub's company-news returns
articles merely associated with a symbol — a Berkshire earnings piece under `AAPL`, a Voya fund
downgrade under `MSFT` — all at confidence 1.0, so the feed gives them the same prominence as
a genuine Apple story.

Finnhub URLs (89% of articles) are `finnhub.io/api/news?id=…`, which 302 to the publisher, so
the source link works and `articles.source` already names the real outlet.

## Consequences

Every card currently reads "not yet classified", because no summarisation run has used a real
API key. Honest, but it makes the tonality indicator look broken until the nightly job runs.

## Known gaps

Confidence 1.0 for `finnhub-symbol` overstates relevance; no pagination, no date window, no
read state. See [improvements.md](../improvements.md).
