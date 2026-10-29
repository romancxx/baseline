# 11. News ingestion

- **Status:** proposed
- **Date:** 2026-10-29

## Context

StockNews should tell a user what was reported about the securities they hold
([0009](0009-portfolios.md)) or watch ([0010](0010-watchlist.md)): 2–3 line summaries with a
tone, gathered into a daily or weekly digest. Like market data ([0007](0007-market-data.md)),
it runs on one local machine, for personal use, at almost no cost.

The web prototype (`apps/web`) built a first pipeline. Its records hold what live runs taught,
and this design starts from them:

- Feed teasers and Finnhub summaries average 260 characters, too short to summarise.
  Summaries need the article's text ([web 0005](../../../web/docs/adr/0005-summarization-and-tonality.md)).
- Finnhub's company news returns articles merely associated with a symbol (a Berkshire
  earnings piece under `AAPL`). A ticker tag is a candidate, not proof
  ([web 0006](../../../web/docs/adr/0006-home-feed.md)).
- Regex mentions over headline and teaser found 9 links in 941 articles
  ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)).
- Embedding distance on headlines could not tell "same story, other outlet" from "same stock,
  other story". A false merge silently hides a story; a missed one repeats a line
  ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)).
- Summarising on a small model costs cents a day. Batching and prompt caching did not pay
  ([web 0005](../../../web/docs/adr/0005-summarization-and-tonality.md)).

Nothing is built yet. This record proposes the design. Each implementation step at the end
updates it with what that step decided and measured.

## Sources

| Source | Gives | Limits | Terms |
| --- | --- | --- | --- |
| Finnhub company news | Articles per ticker: headline, outlet, time, short summary, a `finnhub.io/api/news?id=` link that redirects to the publisher | Free plan: North American companies only, 60 calls a minute, about a year of history; needs a key | Free plan for personal, non-commercial use |
| GDELT DOC 2.0 API | Articles matching a full-text query over worldwide online news: URL, title, domain, language, country, time | At most 250 records a query; dates within the last 3 months; no article text; an unofficial limit of about one request every 5 seconds; noisy | Open data, free to use with citation; the articles remain their publishers' |
| Google News RSS search | Up to about 100 items per query and locale (`hl`, `gl`, `ceid`), with `when:1d` | Links are `news.google.com/rss/articles/…` tokens: the publisher URL takes another request to an internal Google endpoint, which rate-limits (429). No API; it can change without notice | No terms published for this use; Google's Terms of Service apply. Keep the volume low |
| Publisher RSS feeds | Headline, teaser, link and time per item, not aimed at any company | Teasers only; some pages are paywalled | Each publisher's own: personal reading with a link back. Reusing their text is not granted |
| Yahoo search news | `yf.Search(query, news_count=…)`: title, publisher, link, time, sometimes related tickers | A handful of items, mostly US; unofficial | Unofficial, personal use, as in [0007](0007-market-data.md) |

### Decision

- **All five sources**, each a client in `integrations/`: `finnhub`, `gdelt`, `google_news`
  and `rss` (publisher feeds), plus a `search_news` method on `YahooClient`. RSS and Atom are
  parsed with feedparser, which Google News uses too.
- **Queries go per security, not per listing.** A run groups followed instruments by
  `share_class_figi`, and an instrument without one is its own group. Each source is queried
  once per group:
  - Finnhub with the group's US or Canadian listing, and skipped when it has none.
  - Yahoo with any listing's symbol.
  - Google News and GDELT with the security's names (see matching).

  MC.PA and MOH.DE cost one set of queries.
- **Google News and GDELT query each name as an exact phrase, over the last day.** Each
  query runs in English and in the language of the security's home exchange (`PAR` gives
  `hl=fr&gl=FR`), from a map of exchange codes to locales.
- **Stocks only.** ETFs get no news in v1: nothing reports on "an MSCI World ETF", and a feed
  tag is only a proxy ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)).
- **Publishers and tiers live in one file**, `publishers.toml` in the news module. Each
  publisher has a name, its domains, a tier and optionally its feeds (URL, language):
  - **Tier 1:** wires, regulators, company press releases, the leading financial press.
  - **Tier 2:** general and business press.
  - **Tier 3:** aggregators and content sites. A domain not in the file is tier 3.
  - **`excluded`:** the article is dropped when it arrives.

  An article's tier comes from its domain, whatever source found it. Finnhub's and GDELT's
  articles are ranked the same way as the feeds'. Tiers decide which duplicate is kept,
  which articles are summarised first under the cap, and the order in digests. The file is
  reviewed in git like code, and changing it needs no migration.
- **Google News items are filtered before decoding.** Each item names its publisher
  (`<source url="…">`). Items from excluded domains, and titles already stored, are not
  decoded, which saves requests to the endpoint that rate-limits.
- **Each run looks back 3 days**, so a missed run loses nothing. Unique keys absorb the
  overlap (see deduplication).
- **`FINNHUB_API_KEY` is optional.** Without it, Finnhub is skipped and the run says so.

### Alternatives considered

Finnhub alone (its free plan leaves European and Asian holdings without news). NewsAPI (its
free plan is for development only). Paid feeds such as Benzinga, Marketaux or EODHD news (a
cost for a personal app). Social media: X, Reddit, StockTwits (noisy, and their APIs cost
money). Regulatory filings such as SEC EDGAR or AMF (primary sources, but each regulator
needs its own parser; they can join as tier 1 feeds where an RSS feed exists). Feeds in a
database table, as in the web app (editable without a deploy, but there is no admin role and
one user; a file is reviewed).

## Matching articles to securities

### Decision

- **Every link records how it was made** (`method`), so a bad rule shows up in the data
  ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)):
  - `ticker`: the source tagged the article with a listing's symbol (the symbol queried at
    Finnhub, Yahoo's related tickers).
  - `query`: a name query for this security returned the article (Google News, GDELT).
  - `name`: one of the security's names appears in the title or teaser. This covers
    publisher feeds, and every source's articles checked against the other followed
    securities.
- **Names:**
  - The instrument's name without its legal form: "LVMH Moët Hennessy - Louis Vuitton,
    Société Européenne" gives "LVMH Moët Hennessy - Louis Vuitton".
  - Aliases from a hand-kept `aliases.toml`, keyed by the Yahoo symbol of any listing: "LVMH"
    and "Louis Vuitton"; "Alphabet" and "Google".
  - Names match on word boundaries, case-sensitive, with accents folded.
- **Tickers match only in explicit forms** (`$AAPL`, `(NASDAQ: AAPL)`, `(EPA: MC)`), never as
  bare words: `MC`, `OR` and `KO` are ordinary words.
- **A link is a candidate until the model confirms it.** The summarisation call receives the
  article and its candidate securities. For each candidate it returns a relevance:
  - `primary`: the article is about it.
  - `secondary`: it matters to the story.
  - `none`: a passing mention, another entity with the same name, or unrelated.

  News lists show `primary` and `secondary` links, and digests only `primary`. This filters
  Finnhub's loose tags, and names like "Orange", "Shell" or "Next" that are also ordinary
  words.
- **The model chooses only among the candidates**; it cannot add a security. With a closed
  set it cannot invent a link, and every link still has a rule behind it.
- **A link points to one listing, and news is read through the share class.** A link stores
  the listing the group was queried or matched as (its earliest-followed listing). News for
  any listing is read through `share_class_figi`, so MOH.DE shows the LVMH news found through
  MC.PA.

### Alternatives considered

- Letting the model tag every ingested article with the companies it covers: better recall
  ("Instagram" → Meta) for a few dollars a month at Haiku 5.5 prices. Worth adding if the
  name and alias recall measured at step 26 is poor.
- Embeddings: on short text they could not separate stories
  ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)).
- Matching bare tickers.
- Trusting ticker tags ([web 0006](../../../web/docs/adr/0006-home-feed.md)).
- A `securities` table now: a cleaner key, but an instrument whose FIGI arrives late would
  need its links moved. [0006](0006-instruments.md) keeps this table for when a second
  feature needs it.
- A link per listing: duplicate rows, and a listing added later would have none.

## Deduplication and idempotent runs

### Decision

- **Where an item was seen is recorded** in `article_sources`, keyed by
  `(source, external_id)`: the Finnhub id, the Yahoo uuid, the RSS guid (or link), the GDELT
  URL or the Google News token. A re-run recognises an item before making any request for it.
- **URL normalisation:**
  - Follow redirects first: Finnhub's link answers 302, and a Google News token is decoded.
  - Prefer the page's `<link rel="canonical">` once the page is fetched.
  - Lowercase the scheme and host, and drop the fragment.
  - Remove tracking parameters (`utm_*`, `fbclid`, `gclid`, `ocid`, …), sort the remaining
    ones, and drop the trailing slash. courlan, a trafilatura dependency, does most of this.

  `articles.url` is unique, so the same article found by three sources is one row with three
  `article_sources`.
- **Same title.** `title_key` is the title casefolded and accent-folded, without its
  publisher suffix (" - Reuters", " | Les Echos") or punctuation. Two articles with the same
  `title_key` within 3 days are the same story.
- **Near-duplicate titles.** Two articles linked to the same security within 48 hours are
  duplicates when the trigram similarity of their `title_key`s is at least 0.9 (pg_trgm is
  already installed). The bar is strict on purpose: "Apple shares rise after results" and
  "Apple shares fall after results" are close by any string measure, and a false merge hides
  a story. Pairs between 0.6 and 0.9 are logged (`news.near_duplicate_candidate`) so a
  labelled sample can tune the threshold.
- **Same text.** A hash of the normalised extracted text catches wire copy syndicated under
  different titles.
- **Duplicates are kept**, with `duplicate_of_id` pointing at the canonical copy: highest
  tier first, then the copy with text, then the earliest. Only canonical articles are
  summarised; the others show as "also reported by". A wrong merge can be undone.
- **Idempotency comes from unique keys**, with inserts `ON CONFLICT DO NOTHING`, on:
  - `article_sources (source, external_id)` and `articles.url`;
  - links `(article_id, instrument_id)`;
  - summaries `(article_id, model, prompt_version)`;
  - digests `(user_id, period_end)`.
- **Stages read their work from the database.** The stages are fetch, then resolve and
  deduplicate, link, extract text and summarise. Each selects the rows that still need it, so
  a crashed run resumes where it stopped, and a second run with nothing new does nothing.
  - A failed item is recorded and skipped.
  - No transaction stays open during a network call (CODE_STANDARDS §1 and §8).

### Alternatives considered

Embeddings ([web 0004](../../../web/docs/adr/0004-ingestion-pipeline.md)). MinHash or SimHash
over the text (right for grouping articles into stories, which is later work). Deleting
duplicates (loses "also reported by", and a wrong merge cannot be undone). Deduplicating by
URL only (misses syndicated copies).

## Article text

### Decision

- **Fetching:** our own `httpx2` client fetches the page, with:
  - timeouts and a size cap;
  - a User-Agent that names the app;
  - a per-domain rate limit (`aiolimiter`);
  - robots.txt checked and cached per domain.
- **Extraction:** trafilatura (Apache-2.0 since 1.8) extracts the text and its metadata
  (canonical URL, date, language), in a worker thread.
- **Which pages are fetched:** canonical articles with at least one candidate link,
  published within the 3-day lookback, from domains that are not excluded. Unmatched feed
  items keep their headline and teaser only.
- **`text_status`** is one of `pending`, `extracted`, `paywalled`, `blocked` (robots.txt, 401
  or 403) or `failed`. A `failed` page is retried once, on the next run.
- **Paywalls are respected, never bypassed.** A page is `paywalled` when its JSON-LD says
  `isAccessibleForFree: false`, or when the extracted text is shorter than a threshold set
  at step 25. Paywalled articles keep their headline and teaser. The pipeline uses no archive
  mirrors, no crawler User-Agent and no cookie tricks.
- **No text, no summary.** A teaser is shorter than any summary of it
  ([web 0005](../../../web/docs/adr/0005-summarization-and-tonality.md)). The model still
  judges relevance and tone from the headline and teaser, and the publisher's teaser is shown,
  labelled as theirs.
- **Text is kept for 30 days, then cleared.** The API never serves it. 30 days is long enough
  to summarise again with a new prompt, and keeps little copied text on disk.

### Alternatives considered

newspaper4k or readability-lxml (both work; trafilatura is maintained, permissively licensed,
and also returns metadata). A headless browser for pages rendered by JavaScript (heavy, and
few news pages need it). Summarising teasers
([web 0005](../../../web/docs/adr/0005-summarization-and-tonality.md)). Getting past paywalls
(breaks the publishers' terms).

## Storage

### Decision

- **`articles`**:
  - `id`, `url` (unique), `title`, `title_key` (trigram index), `publisher`, `domain`, `tier`
    and `language`;
  - `published_at`, `teaser`, `text`, `text_status` and `text_hash`;
  - `duplicate_of_id` (a self foreign key, `SET NULL`), and timestamps.
- **`article_sources`**: `(source, external_id)` as the key, plus `article_id` (`CASCADE`),
  the URL as received and `seen_at`.
- **`article_instruments`**: `(article_id, instrument_id)` as the key, plus `method` and
  `created_at`. Deleting either side deletes the link.
- **`summaries`**:
  - `id`, `article_id` (`CASCADE`), `model` and `prompt_version`;
  - `input` (`text` or `teaser`), `text` (null when the input was a teaser) and `status`
    (`ok` or `rejected`);
  - token counts and `generated_at`.

  `(article_id, model, prompt_version)` is unique.
- **`summary_instruments`**: `(summary_id, instrument_id)` as the key, plus `relevance` and
  `tone`. Tone belongs to one security, because a story can be good for Airbus and bad for
  Boeing.
- **Enums are Postgres enums**: source, link method, text status, relevance and tone.
- **The provenance line is built when a summary is read**, from the publisher and
  `generated_at`, not stored:
  - "Generated from Reuters on 2026-10-29 at 06:12 UTC" for a summary;
  - "Tone assessed from the Reuters headline and teaser on 2026-10-29 at 06:12 UTC" when
    there was no text.

  It claims only what was generated ([web 0006](../../../web/docs/adr/0006-home-feed.md)).
  The model and prompt version are in the response, not in the line.
- **Read endpoints:** `GET /instruments/{id}/news` and `GET /news` (every followed security),
  both keyset-paginated on `(published_at, id)`. `paginate()` orders on `created_at` today,
  so it gains an ordering column.

### Alternatives considered

Storing the provenance string (changing its wording would need a backfill). Tone on the link
(a new prompt version would overwrite it, so versions could not be compared). A summary per
article and security (pays for the same text once per security). A JSON column of links on
`articles` (no foreign keys, no index for "news of this security").

## Scheduling

### Decision

- **APScheduler 3.x (`AsyncIOScheduler`) in its own process:** `python -m app.jobs.scheduler`,
  run with `just scheduler`. APScheduler 4.0 is still a pre-release. Scheduled jobs call the
  same service functions as the commands.
- **The scheduler stays out of the API process.** `--reload` would restart it on every save,
  several workers would each run every job, and a long job would hold up shutdown.
- **Schedule.** The times are constants in code; the time zone is a setting
  (`SCHEDULER_TIMEZONE`):
  - Prices: weekdays at 23:00, after the US close. The price job from
    [0007](0007-market-data.md) moves here; its "no scheduler yet" changes.
  - News, from fetch to summaries: 06:30, 12:30 and 18:30.
  - Digests: daily at 07:00, and weekly on Mondays at 07:00.
- **Every run is recorded in `job_runs`:** job, trigger (`scheduled`, `manual` or
  `catch_up`), start, end, status (`ok`, `partial` or `failed`), and a JSON result such as
  today's `prices.update_finished` lists. A run where some items failed is `partial`,
  instead of exiting 0 with the failures only in a log line.
- **Missed runs catch up.** Jobs use `coalesce=True`, `max_instances=1` and a one-hour
  `misfire_grace_time`. At start, a job whose last successful run is older than its period
  runs once. A laptop asleep at 23:00 updates prices when the scheduler next runs.
- **One run at a time per job.** A Postgres advisory lock keyed on the job's name is taken
  around each run. A command started during a scheduled run exits and says a run is in
  progress.
- **The commands stay** as manual triggers: `just update-prices`, `just ingest-news`,
  `just summarise-news` and `just send-digests`. Their runs are recorded with the trigger
  `manual`.

### Alternatives considered

- The scheduler inside the API's lifespan (see above).
- Celery: a broker, a worker and beat are three processes plus Redis, for jobs that fit in
  one process.
- Dramatiq: needs a broker, and periodic jobs need another library anyway.
- ARQ: needs Redis, and is in maintenance-only mode.
- Procrastinate: a Postgres-backed queue with periodic tasks, and no new service. Right once
  the API must hand long work to a worker, such as a full news run started from the web app.
- launchd or cron: no code, and launchd even runs calendar jobs missed during sleep. But it
  is macOS-only, lives outside the repo, and has no shared lock or run history.
- APScheduler 4: still a pre-release.

## Summarisation

### Decision

- **Summarisation runs in the news job**, after text extraction, through the Anthropic
  Messages API:
  - an `integrations/anthropic/` client;
  - `claude-haiku-5-5` ($0.10 per million input tokens, $0.50 per million output), at effort
    `low`;
  - structured output (`output_config.format`), checked again with Pydantic.

  Without `ANTHROPIC_API_KEY`, summarisation is skipped and the run says so; articles then
  show their headline and teaser.
- **One call per canonical article**, however many securities or users it concerns:
  - Input: publisher, publication time, headline, text (or teaser), and the candidate
    securities with their names.
  - Output: the summary (null when the input was a teaser), and a relevance and tone for each
    candidate.
- **Format:**
  - 2–3 sentences and at most about 320 characters, enforced by the schema;
  - what happened and the figures that matter, attributed ("Reuters reports…", "the company
    said…").

  A summary that breaks the format gets one corrective retry with the reason. A second
  failure stores it as `rejected`.
- **Tone, per security,** is `positive`, `negative`, `neutral` or `mixed`: how the reported
  facts bear on the company, as reported at the time. It is not about the share price and not
  a forecast, which is why "bullish" and "bearish" are not used. The web app shows it as a
  coloured marker with its word.
- **Summaries interpret news at a point in time and never advise.** The prompt forbids
  recommending, rating or predicting in the summary's own voice: no buy, sell or hold, no
  price direction or target, no "investors should".
  - Facts the article reports are kept with their source. An analyst's rating change is
    reported as such, for example "Jefferies raised its rating to buy" (see open questions).
  - A deny-list check on the output looks for second person, "should buy", "will rise",
    "is set to climb" and similar. A hit gets the corrective retry; a second failure is
    `rejected`, and nothing is shown.
  - Digests and news lists carry one line: "Summaries describe news as it was published.
    They are not investment advice."
- **The prompt is versioned.** `PROMPT_VERSION` in code is part of the summary's key, so a
  new version writes new rows instead of overwriting
  ([web 0005](../../../web/docs/adr/0005-summarization-and-tonality.md)).
- **Cost control:**
  - Each article is summarised once, never per user or per listing.
  - Only canonical articles are summarised, published within the lookback, with a candidate
    link.
  - At most 8 articles per security per run, highest tier first, then newest.
  - Text is capped at 20,000 characters (news puts the facts first); a cut is logged.
  - A run makes at most 200 calls. `SUMMARY_MONTHLY_BUDGET_USD` is checked against the
    stored token counts; past it, the job stops summarising and records why in `job_runs`.

  Estimate: 30 securities give about 150 summaries a day, at about 3,500 input and 400
  output tokens each (thinking included). That is about $0.08 a day, or $2.50 a month.
- **No batches or caching.** The Batch API's 50% saving is not worth polling for results
  later. Prompt caching only applies from 512 tokens on Haiku 5.5, and the system prompt is
  likely shorter; it applies by itself if the prompt grows.

### Alternatives considered

- A synthesis per security per day: one paragraph that reads better in a digest, but it must
  be regenerated as articles arrive, and its provenance spans several sources. It can be
  built later on top of article summaries.
- The `claude` CLI on a Claude subscription
  ([web 0007](../../../web/docs/adr/0007-local-summarization-backend.md)): no API bill, but
  it uses the subscription's limits, takes about 10 s a call, and ties a background job to a
  signed-in CLI.
- A local model through Ollama: free and private, but weaker on French and German text and
  slow on a laptop.
- Sonnet 5.5: 20 times the price for a task Haiku should handle. Switch if Haiku fails the
  evaluation at step 30.
- The Batch API (see above).
- Summarising when a user reads: latency, and a cost per view.

## Notifications

### Decision

- **Each user gets a digest.** A `digest_frequency` setting on users (`off`, `daily` or
  `weekly`) chooses how often. A digest covers the time since the user's last one, at most 7
  days:
  - For each followed security, holdings first: its `primary` articles with summary, tone,
    provenance and link.
  - Securities with nothing new get one line.

  A digest is built from stored rows only; no model is called.
- **Digests are stored, then delivered.** The `digests` table holds user, period, content as
  JSON, `created_at`, `sent_at` and channel. `(user_id, period_end)` is unique, so a re-run
  never sends twice. `GET /digests` and `GET /digests/{id}` show them in the app.
- **Email over SMTP** (`SMTP_*` settings), with Mailpit in `docker-compose.yml` for
  development. Without SMTP settings, digests are stored but not sent.
- **Manual trigger:** `POST /digests` builds and sends the current user's digest now, for the
  time since the last one. `just send-digests` does the same for every user who is due.

### Alternatives considered

An alert per article (noisy, and real-time is out of scope). Push through ntfy or a Telegram
bot (no email setup, and it reaches a phone; a good second channel). macOS notifications (only
reach that machine). In-app only (nothing reaches the user). A hosted email API such as Resend
(an account and a domain, for one recipient).

## Out of scope for v1

- News for ETFs and indices; market-wide and macro news.
- Real-time or intraday alerts.
- A synthesis per security per day, grouping articles into stories, and duplicates across
  languages.
- Connecting news to price moves ("the stock fell because…"), sentiment scores and signals.
- Social media, paid news APIs, and parsers for regulatory filings.
- Getting past paywalls, or rendering pages with a headless browser.
- Feeds or aliases edited by users; news search; read and unread state.
- History older than the 3-day lookback.
- Translation, unless the summary language requires it (see open questions).
- Running on more than one machine.

## Consequences

- Securities with a US or Canadian listing get ticker-tagged news from Finnhub. European and
  Asian ones depend on name queries, feeds and Yahoo. Their recall depends on the aliases,
  and is weakest for names that are ordinary words.
- Google News decoding is the most fragile part. When it fails, that source's items are
  skipped and logged, and the other sources carry on.
- The model's relevance check is on the path to showing anything. Without an API key or past
  the budget, links stay candidates and articles show without summaries.
- Model spend has a monthly ceiling, and a run missed during sleep catches up.
- The scheduler is one more process to keep running.

## Implementation steps

- **Step 18: Scheduler.** `app.jobs.scheduler` on APScheduler 3.x, the `job_runs` table,
  advisory locks, catch-up at start, `SCHEDULER_TIMEZONE`, `just scheduler`. Move
  `update_prices` under it. Update [0007](0007-market-data.md) and the price rows in
  `improvements.md`.
- **Step 19: News storage.** Models and migration for `articles`, `article_sources` and
  `article_instruments`, plus the URL normaliser and `title_key` as pure functions, with
  tests.
- **Step 20: Publisher feeds.** `publishers.toml` with tiers, the `rss` client, and an
  ingestion service that stores articles and sources, deduplicated by URL. Add
  `just ingest-news`.
- **Step 21: Name matching.** Names without legal forms, `aliases.toml`, explicit ticker
  forms, and `name` links for followed securities, grouped by share class.
- **Step 22: Finnhub.** Client, choice of the North American listing, redirect resolution,
  and `ticker` links.
- **Step 23: Google News.** Client, locale map, filtering by publisher before decoding, and
  `query` links.
- **Step 24: GDELT and Yahoo news.** The GDELT client (confirm its rate limit) and
  `YahooClient.search_news`.
- **Step 25: Article text.** Fetcher (robots.txt, per-domain limits, size cap),
  trafilatura, `text_status`, paywall detection with a measured threshold, text hash, and
  clearing text after 30 days.
- **Step 26: Near-duplicates.** Same title, title similarity and same text; choosing the
  canonical copy; logging candidate pairs. Measure on a week of real articles and record the
  numbers here.
- **Step 27: Summarisation.** The Anthropic client, `summaries` and `summary_instruments`,
  the prompt and its version, format and deny-list checks with one retry, caps and budget,
  and `just summarise-news`. Scheduled after ingestion.
- **Step 28: News API.** `GET /instruments/{id}/news` and `GET /news`, the provenance line
  in the read schema, and `paginate()` taking an ordering column.
- **Step 29: Digests.** `digest_frequency`, the `digests` table and builder, the SMTP sender
  with Mailpit, `GET`/`POST /digests`, `just send-digests`, and the schedule.
- **Step 30: Evaluation.** Hand-label about 100 articles for relevance, tone and duplicates;
  measure agreement and alias recall, and record the results in this ADR.

## Open questions

1. **Summary language:** English, French, or the article's own language?
2. **Model backend:** the Anthropic API (about $2–3 a month, needs a key), or the `claude`
   CLI on your subscription, as the web app allows?
3. **Notification channel:** email (and through which SMTP account?), push through ntfy or
   Telegram, or in-app only for now?
4. **Publishers:** which outlets do you read and trust, and in which markets (France,
   Germany, UK, US, Asia)? This seeds `publishers.toml` and the Google News locales.
5. **Analyst ratings:** may summaries report rating and price-target changes with their
   source ("Jefferies raised its rating to buy"), or should they leave them out?
6. **Times:** are the proposed run times right for your time zone, and is the machine usually
   on at 06:30 and 23:00 (or should it catch up at login)?
7. **ETFs:** is "no ETF news in v1" acceptable, or should an ETF at least show its index's
   headlines?
8. **Users:** is this only for you? If so, digest settings could be a single setting instead
   of a field on each user.
