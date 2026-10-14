# Improvements

Deliberate shortcuts, per feature. Each entry says what exists today, what it should
become, and what makes it worth doing — so that the next person (you, in three weeks) is
reading a decision rather than guessing at an omission.

## portfolio

**Optimistic UI on mutations.** Add, edit and remove currently round-trip to the server and
wait for `revalidatePath` before the list changes, so every keystroke-to-confirmation is a
full request. `useOptimistic` around the position and watchlist lists would make the row
appear, change or disappear immediately and roll back if the action returns an error. Worth
doing once the list is long enough that the reflow is noticeable, or on a slow connection —
not before, because the rollback path is real code and real tests for a list of eight rows.

**Inline validation.** Errors surface only after a submit. Client-side Zod against the same
schema would catch a negative quantity before the round-trip.

**Sorting and grouping.** Positions render in insertion order. Sorting by ticker or grouping
by `macro_bucket` is the obvious next step once the list outgrows a screen.

## ingestion

**Near-duplicate detection cannot separate two real cases.** Over 403 ingested articles,
"same story from two outlets" and "same stock, two different stories" both land between
0.10 and 0.14 cosine distance. At 0.17, roughly a third of collapses were wrong — two
different Jim Cramer segments merged, as did two unrelated Alphabet pieces.
`NEAR_DUPLICATE_DISTANCE` is therefore 0.08, which catches only near-verbatim rewording
and lets most duplicates through. That is the right trade for now, because a false collapse
means an article never gets summarised and the story silently vanishes, while a missed
duplicate only costs a repeated line in the digest.

Fixing it properly needs more signal than a headline: full article text, or a cheap
pre-filter (same day, shared instrument) before trusting the distance at all. Either way it
wants a labelled sample of a few hundred pairs to tune against, not one day and a guess.

**The text-mention rule barely fires, and an LLM could replace it.** `rss-mention` produced
9 links across 941 articles — a regex over a headline and one sentence finds almost nothing.
The summarisation call already sends the article text, and input tokens are what you pay
for, so asking the same call to return the tickers it noticed costs only a few output
tokens. Nearly free, and far better recall than the regex.

The reason not to wire it up blindly is that a generative rule can pollute the matching
data. The shape that avoids it: ask for a per-ticker confidence, keep only tickers already
in the universe, and write an `llm-mention` link only above a high bar — a company named
once in passing is not what the article is about, whereas one named throughout is. Because
`match_method` is stored per link, the rule stays auditable and removable after the fact.

**ETFs have no real news source.** `rss-bucket` links exist because nothing publishes "SPY
news" — an ETF wraps an index, so what moves it is macro coverage, and a feed tag is a
proxy for relevance rather than evidence of it. That is why those links sit at 0.5 and why
summarisation deliberately skips them for now. Doing ETFs properly means an index-level news
source (or per-index feeds for S&P 500, CAC 40, and so on), not a better threshold.

**Bodies are as short as the feed makes them.** RSS gives a description, Finnhub a summary;
neither is the article. Embeddings and, later, summaries are working from a headline plus
a sentence or two. Fetching and extracting the full page would improve both, at the cost of
scraping, and of respecting each outlet's terms.

**No semiconductor feed.** Every bucket except `big-tech` and `financials` gets its news
from the broad-market feeds. Stocks in those buckets are covered by Finnhub, but a
sector-specific ETF like `SMH` currently only matches broad-market coverage.

**Sequential near-duplicate lookups.** Each fresh article makes its own `match_articles`
round-trip. Fine for the ~50 articles a night this produces; batch it if the universe grows.

**Ingestion is unmonitored.** A failed nightly run shows up as a red cross in the Actions
tab and nowhere else. Worth a notification once the digest actually depends on it.

## summarisation

**No summaries yet, by design.** `summary_text` is null on every row because the source
bodies are ~260 characters — the headline already is the summary. This unblocks when article
text does: either full-page extraction (see the ingestion note above) or a source that
carries real body text.

**Per-instrument synthesis is probably the better product.** Rather than one summary per
article, one short paragraph per instrument per day — "what happened to AAPL today" across
its handful of headlines. It genuinely needs a model (a headline cannot be synthesised from
itself), costs ~38 calls instead of ~350, and is what a digest actually reads like. It
belongs in `digests.payload` rather than the per-article `summaries` table, which is why it
was not folded into this phase.

**Tonality is unevaluated.** There is no labelled set, so the only evidence that the
classifier is any good is reading its output. Before trusting the colour indicator, hand-label
a hundred headlines and measure agreement — the same discipline the dedup threshold needed,
and for the same reason.

**No prompt caching.** The system prompt is ~300 tokens, below the 512-token minimum
cacheable prefix, so caching cannot engage. It would become worthwhile if the prompt grows
or few-shot examples are added.

## instruments

**Real directory API.** `instrument-directory.ts` reads the seeded table. Swapping in EODHD
search or an ESMA FIRDS bulk import means changing what fills `instruments`, not what reads
it — the module boundary exists for exactly this.

**ISINs are missing.** The seed file carries tickers and names only; a ticker is not a
global identity (the same symbol trades on several exchanges). Fill `isin` from your broker
statement, or from the directory API when it lands, and the `instruments_isin_key` index
starts earning its keep.

**Type-ahead search.** `searchInstruments` exists and nothing calls it — the picker is a
plain `<select>` over the full universe. Fine at ~35 instruments, wrong at 3,000.

## auth

**Password reset.** There is no recovery flow. Supabase's `resetPasswordForEmail` plus a
callback route is the missing piece; today a forgotten password means a manual reset in the
dashboard.

**Email confirmation is off.** Deliberate for a single-user build. Turn it on before anyone
else signs up, which brings back the `/auth/callback` route the magic-link flow needed.

## news

**`finnhub-symbol` confidence of 1.0 is too generous, and the feed makes it visible.**
Finnhub's company-news endpoint returns articles loosely associated with a symbol, not only
articles about it: a Berkshire Hathaway earnings piece arrives under `AAPL`, and a Voya fund
downgrade under `MSFT`. The link is certain (the symbol was the query) but the *relevance* is
not, and the card gives both the same prominence. Either lower the confidence for this method
and sort the feed by it, or check that the company is actually the subject — which is the same
LLM-mention work described above.

**No pagination or date window.** The feed is a flat `FEED_LIMIT` of 50 ordered by
publication time. Fine for one user and ~900 articles; it needs a cursor and a "since you last
looked" marker before it is a daily habit.

**Nothing marks an item as read.** Every visit shows the same cards. A `last_seen_at` per user,
or per-item read state, is what turns the feed into something you can finish.

**Tonality is absent until the nightly job runs with a key.** Every card currently renders
"not yet classified", which is honest but makes the colour indicator look broken. Worth a
one-line hint on the feed when no summaries exist at all.

## ui

**The sidebar is desktop only.** Below roughly 900px the screen gets too narrow beside a
fixed 224px column. A collapsed or top-bar variant is needed before the app is used on a
phone.

**Watchlist, Themes and Settings are disabled nav entries.** The watchlist still lives on
the Portfolio screen. Each becomes a link when its screen exists — one `href` in
`(app)/layout.tsx`.

**The Review screen has no time window.** The mockup reads "7 / 214 articles kept this
morning": what reached you out of everything ingested since the last run. Today the screen
shows only the kept count, over the latest 50 articles (`FEED_LIMIT`), and the rail says
"Covered" rather than "Covered this morning". A window needs a notion of a run — the last
ingestion's start time, or `articles.created_at` within the last 24 hours — then a second
count over all canonical articles in it, and the same window applied to `listFeed`. The
sidebar's Review count waits on the same number.

**Model attribution moved to a tooltip.** The provenance line now shows only the source and
publication time, per the mockup; "tonality by {model}" is in the badge's hover text, which
touch screens and many readers never see.

**The account footer drops the mockup's "Daily review · 7 h" line.** There is no review
schedule to show; a quiet "Sign out" sits there instead.

**`danger` borrows `tone-negative`.** The mockup defines no error colour, so a failed form
and a bearish headline share orange. Worth a distinct value once the design has one.

**The product name is inconsistent.** The sidebar follows the mockup ("StockNews"); page
titles and the login screen still say "Stock News".
