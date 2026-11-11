# 10. News ingestion

- **Status:** proposed
- **Date:** 2026-10-29

## Context

StockNews should tell a user what was reported about the securities they hold
([0009](0009-portfolios.md)): a short brief per security
with a tone, and the headlines behind it. Like market data ([0007](0007-market-data.md)), it
runs on one local machine, for personal use, at almost no cost.

The web prototype (`apps/web`) built a first pipeline. Its records hold what live runs taught,
and this design starts from them:

- Feed teasers and Finnhub summaries average 260 characters, too short to summarise.
  Summaries need the article's text ([old web 0005](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0005-summarization-and-tonality.md)).
- Finnhub's company news returns articles merely associated with a symbol (a Berkshire
  earnings piece under `AAPL`). A ticker tag is a candidate, not proof
  ([old web 0006](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0006-home-feed.md)).
- Regex mentions over headline and teaser found 9 links in 941 articles
  ([old web 0004](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0004-ingestion-pipeline.md)).
- Embedding distance on headlines could not tell "same story, other outlet" from "same stock,
  other story". A false merge silently hides a story; a missed one repeats a line
  ([old web 0004](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0004-ingestion-pipeline.md)).
- Summarising on a small model costs cents a day. Batching and prompt caching did not pay
  ([old web 0005](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0005-summarization-and-tonality.md)).

An earlier draft of this record proposed five sources, links confirmed by the model, article
text, per-article summaries, a scheduler and email digests. That is more than a personal
project needs. This version keeps one source and one model call per security; the parts it
leaves out are in [improvements.md](../improvements.md), each with when it becomes worth
doing.

## Sources

| Source | Gives | Limits | Terms |
| --- | --- | --- | --- |
| Google News RSS search | Up to about 100 items per query and locale (`hl`, `gl`, `ceid`), with `when:1d`; each item names its publisher (`<source url="…">`) | Links are `news.google.com/rss/articles/…` tokens: the publisher URL takes another request to an internal Google endpoint, which rate-limits (429). No API; it can change without notice | No terms published for this use; Google's Terms of Service apply. Keep the volume low |
| Finnhub company news | Articles per ticker: headline, outlet, time, short summary, a `finnhub.io/api/news?id=` link that redirects to the publisher | Free plan: North American listings only (including the US listings of foreign companies, such as `TM` or `SAP`), 60 calls a minute, about a year of history; needs a key. Tags are loose (see probes) | Free plan for personal, non-commercial use |
| GDELT DOC 2.0 API | Articles matching a full-text query over worldwide online news: URL, title, domain, language, country, time | At most 250 records a query; dates within the last 3 months; no article text; an unofficial limit of about one request every 5 seconds; noisy | Open data, free to use with citation; the articles remain their publishers' |
| Publisher RSS feeds | Headline, teaser, link and time per item, not aimed at any company | Teasers only; some pages are paywalled | Each publisher's own: personal reading with a link back. Reusing their text is not granted |
| Yahoo search news | `yf.Search(query, news_count=…)`: title, publisher, link, time, sometimes related tickers | Nothing for non-US symbols, and a mostly stale or noisy list by name (see probes); unofficial | Unofficial, personal use, as in [0007](0007-market-data.md) |

### Probes

Two throwaway scripts queried six stocks (AAPL, MC.PA, TTE.PA, SAP.DE, ASML.AS, 7203.T) on
2026-10-30, over the last 3 days.

- **Yahoo search news is unusable outside the US.** Each of the five non-US symbols
  returned 0 items. By name, "SAP" returned 0 too, and "LVMH" 45 items of which 2 were from
  the last 3 days. For Apple, 18 of 48 items were GuruFocus fund-flow posts ("iShares MSCI
  World ETF Buys $17.3 Million More Apple").
- **A plain name query is mostly not finance.** The share of titles with a finance word
  (shares, earnings, revenue, analyst, …) for `"<name>"` in English, then with finance terms
  added to the query:

  | Stock | Plain: items (finance share) | With finance terms |
  | --- | --- | --- |
  | Apple | 100 (15%) | 100 (76%) |
  | Toyota | 100 (10%) | 30 (56%) |
  | LVMH | 39 (41%) | 18 (66%) |
  | SAP | 100 (19%) | 36 (63%) |
  | ASML | 45 (48%) | 62 (87%) |
  | TotalEnergies | 100 (43%) | 100 (70%) |

  Plain queries return gadget, car, sports-arena and local news: "SAP Center", "TOYOTA ARENA",
  iPad reviews. The finance words in the query and in the check are the same, so the gain is
  an upper bound. Plain queries hit Google's 100-item cap over 3 days for four of the six.
- **Material stories without finance words fall out.** The top plain results included
  Reuters on Toyota and Waymo's robotaxi deal, Reuters on SAP replacing costly AI models to
  save over €2bn, and TotalEnergies cutting diesel prices in France. None was among the first
  12 results with finance terms.
- **Finance terms bring their own junk:** Yahoo pages for option contracts ("ASML Nov 2026
  1060.000 put", 6 of ASML's first 12), tokenized-stock pages, quote and seasonal-chart pages,
  and a title that reads `META_TITLE_QUOTE`. One aggregator, ad-hoc-news.de, appeared for
  LVMH, SAP and ASML (16 of SAP's 36).
- **Finnhub's tags are loose.** Under `TM`: PACCAR, Lithia and Holley. Under `SAP`: Rimini
  Street, New Relic and partners' press releases. Under `ASML`: Samsung, TSMC and SK hynix.
  Under `TTE`: Capgemini. Under `AAPL`: 155 items in 3 days, including Berkshire's portfolio.
  42% to 70% of its titles had a finance word. It names the outlet "Yahoo" for 113 of
  Apple's 155, so its `source` field cannot rank publishers.

A third script tried headline-only briefs on 2026-10-31: the first 40 results of the finance
query (over 3 days) for Apple, TotalEnergies, SAP and LVMH, numbered, sent to the `claude`
CLI's default model with this record's rules.

- **They are usable.** Each brief was 4 sentences, 505 to 595 characters, attributed, with no
  advice, citing 5 to 9 headlines, and no ID outside the input. The default model is
  stronger than Haiku at effort `low`, so this is an upper bound.
- **SAP's AI-model story was in the brief.** Seeking Alpha and GuruFocus covered it with
  finance words, though Reuters' headline had none.
- **ad-hoc-news.de carried SAP's brief**: 5 of its 9 citations, including the only source for
  the raised 2026 guidance, and 2 of LVMH's 5. Excluding it leaves those briefs thinner.
- **Conflicting headlines got one side.** Investing.com reported TotalEnergies' revenue
  "topped estimates", 24/7 Wall St. a "revenue miss"; the brief gave only the miss.
- **Not every fact maps to a cited headline.** "Monday, Nov. 2" for Apple's results came from
  "this Monday" and the date, or from a headline it did not cite. The ID check cannot see
  this.
- **Near-duplicates reach the input:** Bloomberg's and Yahoo Finance UK's "Apple overtakes
  Nvidia" differ by a few words, so their `title_key`s differ, and both were cited.

### Decision

- **One source in v1: Google News RSS**, in English (`hl=en-US&gl=US&ceid=US:en`). It covers
  European and Asian companies, which Finnhub's free plan and Yahoo do not. Other languages
  are out of scope.
- **Sources sit behind a `NewsSource` protocol** (a `typing.Protocol`) in the news module's
  `service.py`: a `source` attribute, the `ArticleSource` recorded on each of its articles,
  and one method, `async fetch(query: NewsQuery) -> FetchResult`. A `NewsQuery` is
  a security's name and a start time; a `FetchResult` holds the `RawArticle`s (URL, title,
  publisher and publication time) and how many items the source dropped, by reason, for the
  run's log line. A source matches the protocol by having that method, without inheriting
  from it, and raises `ProviderUnavailableError` when it cannot be reached. Tests use a
  `FakeNewsSource` from `tests/conftest.py`.
- **A source is a client and an adapter.** `integrations/google_news/` speaks Google's
  language (a query and a locale in, parsed feed items out, with feedparser). The client
  fetches with `httpx2` and hands feedparser the body as a stream: given bytes or a string,
  feedparser first tries to open it as a file path or a URL. An item missing a field is
  skipped and counted in a log line; an answer that is not a feed raises
  `ProviderUnavailableError`. Nothing in the API uses the client, so it is not created in the
  lifespan; the command that uses it creates and closes it.
  `GoogleNewsSource`, in the news module's `sources.py`, builds the query, drops the junk and
  the off-topic items, and maps the rest to `RawArticle`s; items published before the query's
  start time are dropped as `too_old`. Integrations cannot import from modules, so the adapter is what lets the
  client stay unaware of `NewsQuery` and `RawArticle`. Each article records its source.
- **Finnhub is the planned second source**, deferred. Its loose tags make it a source of
  candidates that the model would have to confirm.
- **Requests are few and spaced.** One request per security group, one after another, a
  second apart, with a User-Agent that names the app.

### Alternatives considered

Finnhub alone (its free plan leaves European and Asian holdings without news). Yahoo search
news (nothing outside the US). GDELT and publisher feeds (more parsers and more noise for a
first version). NewsAPI (its free plan is for development only). Paid feeds such as Benzinga,
Marketaux or EODHD (a cost for a personal app). Social media (noisy, and their APIs cost
money). All five sources at once, as in the earlier draft (most of the work for recall a
personal app can do without).

For the adapter: inside `service.py` (Google-specific code beside the ingest logic), or the
protocol and its models in `core/` with the adapter in `integrations/` (`core/` would know
about news). The publisher's domain in `RawArticle`, filtered in the news module (a field for
one source's problem; a source with real URLs has none).

## Queries

### Decision

- **One query per security, not per listing.** Followed stocks, held in any position, are
  grouped by `share_class_figi`; an instrument without one is its own
  group. MC.PA and MOH.DE cost one query.
- **The query is the name as an exact phrase, plus finance terms, over the last day:**
  `"LVMH Moët Hennessy - Louis Vuitton" (shares OR stock OR earnings OR results OR revenue OR
  analyst OR investors) when:1d`. The name is that of the group's first-stored listing
  (earliest `instruments.created_at`), without its legal forms: `news_name` removes them from the end, with the comma or `&`
  before them, until none is left ("Samsung Electronics Co., Ltd." gives "Samsung
  Electronics"; "JPMorgan Chase & Co." gives "JPMorgan Chase").
- **Stocks only.** ETFs get no news: nothing reports on "an MSCI World ETF".

### Alternatives considered

The plain name (mostly not finance, see probes). Plain and finance queries both (twice the
requests, and the plain one's results are mostly what a brief should leave out). A longer
lookback (`when:3d` hit the 100-item cap; duplicates across runs would need the same
handling anyway). Queries in the home market's language (out of scope).

## Filtering and deduplication

### Decision

- **Junk is dropped before storage**, by `drop_junk` in the `google_news` integration, which
  returns the items it kept and a count per reason:
  - `excluded_domain`: ad-hoc-news.de, youtube.com, imdb.com and cryptorank.io, with their
    subdomains. Links are not decoded, so the domain is known only from the item's
    `<source url="…">`, and `RawArticle` does not carry it.
  - Pages that are not articles, recognised by their titles for the same reason:
    `quote_page` ("Stock Price, News, Quote", `META_TITLE_QUOTE`, and Boursorama's quote
    pages, titled "<name> - Boursorama - Boursorama"), `chart_page` ("Seasonal Returns
    Chart", "Charts, Data & News", "Interactive Stock Chart"), `option_page` ("Nov 2026
    1060.000 put", symbols such as `ASML261120P01060000`) and `derivative_page` ("Tokenized
    Stock").

  The patterns come from feeds recorded on 2026-10-31; no option page appeared that day, so
  that rule is checked only on the earlier probes' titles.
- **An item whose title does not name the security is dropped as `off_topic`.** Google
  matches the query's phrase anywhere in the article, so a market roundup that mentions the
  company in passing comes back too. The title must contain the first word of the news name
  as a whole word, ignoring case and accents: "ASML" for "ASML Holding N.V.", which "ASM
  International" does not match.
- **Google's links are stored as they are**, not decoded: decoding takes a request per item
  to an endpoint that rate-limits.
- **Duplicates are not stored twice:**
  - `articles.url` is unique.
  - `title_key(title, publisher)` is the title casefolded and accent-folded (Unicode NFKD,
    combining marks dropped), without Google's " - Publisher" suffix, with each run of
    punctuation and spaces made one space: "Apple’s Q3 Beats Estimates - Reuters" gives
    "apple s q3 beats estimates". The suffix is matched folded too, so "LES ÉCHOS" strips
    " - Les Echos". An article whose `title_key` matches one published within 3 days is the
    same article.

  A duplicate adds its links to the stored article instead of a row.
- **Runs are idempotent.** Inserts use `ON CONFLICT DO NOTHING` on the URL and on the links'
  key, so a second run with nothing new changes nothing. No transaction stays open during a
  network call (CODE_STANDARDS §1 and §8).
- **A group that fails is logged and skipped**; the others carry on. Each group's articles
  and links are stored in one transaction. The run logs one `news.ingest_finished` line: the
  followed stocks, the queries sent, the articles fetched, new and deleted, the links added,
  the items dropped by reason, and the failed queries with their reason.

### Alternatives considered

Decoding the links and normalising publisher URLs (a request per item, and it rate-limits).
Near-duplicate titles by trigram similarity, or a hash of the text (needs a labelled sample
to tune; titles are enough for one source). Embeddings
([old web 0004](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0004-ingestion-pipeline.md)). Publisher tiers in a file
(they decide which copy to keep and what to summarise first, choices a brief over 40
headlines does not need).

## Matching articles to securities

### Decision

- **An article is linked to every followed instrument of the group it was fetched for.** The
  query is the match: no name matching across groups, and no model confirming links.
- **A link is `(article_id, instrument_id)`** with `created_at`. A security's news is read
  through any of its listings' links.

### Alternatives considered

Name and ticker matching across all articles, links confirmed by the model, and a `method`
recorded per link, as in the earlier draft (needed once there are several sources or
untargeted feeds; one targeted query per group needs none). Linking one listing and reading
through `share_class_figi` (no row per listing, but a listing whose FIGI arrives late would
need its links moved).

## Storage

### Decision

- **`articles`**: `id`, `source` (a Postgres enum, `google_news` for now), `url` (unique),
  `title`, `title_key`, `publisher`, `published_at` and `created_at`. The text columns are
  `text`: a feed's values have no natural length. An index on `(title_key, published_at)`
  serves the duplicate check.
- **`article_instruments`**: `(article_id, instrument_id)` as the key, plus `created_at`.
  Deleting either side deletes the link.
- **`briefs`**: `id`, `group_key` (the group's share class FIGI, or the id of an instrument
  without one), `text`, `tone` (a Postgres enum), `model` (the backend and model, such as
  `api:claude-haiku-5-5`), `prompt_version`, `input_tokens` and `output_tokens` (summed over
  the attempts; null when the backend reports none), `period_start` and `period_end` (the
  publication times of the oldest and newest headline sent) and `generated_at`. An index on
  `(group_key, generated_at)` serves the lookup of a group's latest brief.
- **`brief_articles`**: `(brief_id, article_id)`, the articles a brief cites. It cascades
  from either side.
- **No article text and no teasers are stored.** Google's teaser repeats the title.
- **Articles are kept 30 days.** Each ingest run ends by deleting those published earlier,
  with their links.

### Alternatives considered

Tone on each article (one call per article, the cost the earlier draft paid for per-article
summaries). A JSON column of links (no foreign keys, no index for "news of this security").
A `brief_instruments` table of the group's instruments (a row per listing for what
`group_key` says in one column).

## Briefs

### Decision

- **One Anthropic call per security group**, over its most recent stored articles of the
  last 3 days: at most 40, newest first, each with a number from 1, its headline, publisher
  and publication time, after the security's name. No article text. The model cites the
  numbers, which are mapped back to article IDs: short numbers are cheaper and harder to
  garble than UUIDs.
  - An `integrations/anthropic/` client over the official `anthropic` SDK,
    `claude-haiku-5-5` ($0.10 per million input tokens, $0.50 per million output) at effort
    `low`. The model is the `ANTHROPIC_MODEL` setting. Without a key, the local `claude`
    CLI can write them on a Claude subscription ([0011](0011-local-llm-backend.md)).
  - Structured output (`output_config.format`, from the Pydantic model's JSON schema through
    the SDK's `transform_schema`), checked again with Pydantic. An answer that does not
    validate, or did not end normally (`max_tokens`, `refusal`), raises `InvalidOutputError`
    with the reason, which the caller can send back in its retry.
  - The SDK retries rate limits, overloads, server errors and dropped connections twice,
    with exponential backoff and jitter, or after the API's `retry-after`. What still fails
    raises `ProviderUnavailableError`; a rejected key says so in its message.

  Without a backend (no `ANTHROPIC_API_KEY` and no `claude` CLI), the command logs
  `skipped` and exits 0; news
  shows headlines only.
- **Output:**
  - a brief of 1–5 sentences, at most about 600 characters: what was reported, attributed
    ("Reuters reports…", "the company said…"), using only what the headlines say, and
    saying so when outlets disagree. It is empty when no headline bears on the business, and
    then nothing is stored: no brief is better than filler;
  - a tone;
  - the IDs of the articles it used. An ID not in the input fails the check.
- **Tone** is `positive`, `negative`, `neutral` or `mixed`: how the reported facts bear on
  the company, as reported at the time. It is not about the share price and not a forecast,
  which is why "bullish" and "bearish" are not used.
- **Briefs describe news at a point in time and never advise.** The prompt forbids
  recommending, rating or predicting in the brief's own voice: no buy, sell or hold, no price
  direction or target, no "investors should".
  - Facts the headlines report are kept with their source. An analyst's rating change is
    reported as such, for example "Jefferies raised its rating to buy".
  - A deny-list check on the output looks for second person, "should buy" and similar, and
    "investors should".
  - The brief's response carries a fixed disclaimer: "Describes news as reported. Not
    investment advice."
- **The prompt's rules** come from what the headline-only probe got wrong: only what the
  headlines say; dates and figures repeated as written, never computed ("this Monday" stays
  so); disagreeing outlets named both; headlines not about the company ignored; claims
  attributed; no advice or forecast; tone from the main story, `mixed` only when both sides
  carry weight. A first live run (prompt version 1) padded thin input with items that do not
  bear on the business (Toyota's basketball team, a fund's share sale) and with comments
  about the headlines themselves ("a routine explainer"), so version 2 allows one or two
  sentences, or none, and forbids both.
- **Checks in code**, after the schema's: at least one citation, every cited number in the
  list, 40 to 700 characters (the prompt asks for at most 600), and a deny-list of second
  person, "should buy" and the like, and "investors should": phrases attributed reporting
  does not use. An empty text passes, as no news. Forecasts and price targets are left to
  the prompt: "the company said sales will rise" or "Jefferies set a price target of $250"
  is reported, and a phrase cannot tell it from the brief's own voice.
- **A brief that fails a check**, or an answer that is not a brief, gets one corrective
  retry: the same message, plus the rejected text and every reason. A second failure is
  logged and nothing is stored; the previous brief stays.
- **A brief is regenerated only when new articles arrived**: a group gets a new one when one
  of its articles was published after the newest headline of its latest brief. Older briefs
  are kept.
- **The prompt is versioned.** `PROMPT_VERSION` in code is stored with each brief
  ([old web 0005](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0005-summarization-and-tonality.md)).
- **The provenance line is built when a brief is read**, not stored: the number of cited
  articles still stored, the UTC days from `period_start` to `period_end`, and
  `generated_at`, as in "From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC". It is
  a Pydantic computed field of `BriefRead`, so it is derived from the fields beside it and
  cannot disagree with them. The model and prompt version are in the response, not in the
  line.
- **Cost:** 40 headlines and the instructions come to about 2,500 input tokens, and the
  output with thinking to about 400. That is about $0.0005 a brief, or 1.5 cents for 30
  securities.

### Alternatives considered

- Per-article summaries from extracted text, as in the earlier draft: better briefs, but a
  fetcher, trafilatura, robots.txt and paywall handling, and a call per article.
- Summarising teasers ([old web 0005](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0005-summarization-and-tonality.md)):
  Google's teaser repeats the title.
- The `claude` CLI on a Claude subscription as the only backend
  ([old web 0007](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0007-local-summarization-backend.md)): no API bill, but
  about 10 s a call, and a command tied to a signed-in CLI. It is the second backend
  instead ([0011](0011-local-llm-backend.md)).
- A local model through Ollama: free and private, but slow on a laptop.
- Sonnet 5.5: 20 times the price for a task Haiku should handle. Switch if Haiku fails the
  [evaluation](#evaluation).
- Storing rejected briefs (a status column for rows nothing shows).

## Running

### Decision

- **Commands only:** `python -m app.jobs.ingest_news` (`just ingest-news`) and
  `python -m app.jobs.generate_briefs` (`just brief`), wired as in
  [0002](0002-api-architecture.md). No scheduler, no digests, no email.
- **Two read endpoints, by instrument**, each reading the instrument's share class, so any
  listing works, followed or not: MOH.DE shows what was fetched for MC.PA.
  - `GET /instruments/{id}/brief`: the group's latest brief (by `generated_at`, then `id`),
    with its cited articles (title, publisher, publication time, URL), newest first, its
    provenance line and the disclaimer. 404 when the group has none.
  - `GET /instruments/{id}/news`: the group's articles, newest published first,
    keyset-paginated on `(published_at, id)`: `paginate()` takes the order column, and
    defaults to `created_at` for every other list.
- **The latest brief of each held security, by portfolio**: `GET /portfolio/briefs` groups the portfolio's held instruments by share class, with the same `group_key` as the jobs, and gives each group its held listings and its latest brief, in the shape of `GET /instruments/{id}/brief`, or `null`.
  ETF groups are listed with `news_collected: false` and no brief, so a client tells "no news for ETFs" from "no brief yet".
  Groups with a brief come newest generated first, then the others by name, ignoring case.
  One `DISTINCT ON (group_key)` query reads the latest brief of every group, with the same order as the instrument endpoint (`LATEST_FIRST`).
  Not paginated: a personal portfolio holds tens of securities, as for the overview ([0009](0009-portfolios.md)).
- **The cited articles load with the brief**: `Brief.articles` is a read-only relationship
  through `brief_articles`, loaded with `selectin` (a second `SELECT … WHERE id IN`). The job
  writes citations as `BriefArticle` rows and never touches it.

### Alternatives considered

A scheduler process, digests and email, as in the earlier draft (deferred).
A `GET /news` feed over every followed security (deferred until the web app has a home feed).
One endpoint with the brief and the 40 headlines it was written from (no way to read older articles; the brief's cited articles already show its sources).
Paginating news on `created_at` (the order the job stored them, not the order they were published).
The web calling `GET /instruments/{id}/brief` once per position (one request per holding, a 404 to read as "no brief", and the share-class grouping and the stocks-only rule copied into the browser).
Leaving ETFs out of the portfolio's briefs (the web could not tell a held ETF from a stock still waiting for its first brief).

## Evaluation

### Decision

- **A week of daily runs is checked before the design is relied on.** This record gets the
  articles per group, how many were dropped and merged, brief failures and token cost, and a
  hand check of about 20 briefs on Haiku: facts not in their cited headlines, and material
  stories missed against a plain query.

## Out of scope for v1

- News in other languages, and duplicates across languages.
- News for ETFs and indices; market-wide and macro news.
- Real-time or intraday alerts; connecting news to price moves; sentiment scores.
- Social media, paid news APIs and regulatory filings.
- Getting past paywalls.

## Consequences

- **Material stories without finance words can be missed**, such as Reuters on Toyota and
  Waymo's robotaxi deal. The probes measured this gap; the [evaluation](#evaluation)
  checks how often it hides something that matters.
- **Recall depends on one name per security.** Official names can be longer than what the
  press writes ("LVMH Moët Hennessy - Louis Vuitton" for "LVMH", "ASML Holding" for "ASML"),
  and an exact phrase then finds little.
- **A title that names the company another way is dropped.** One that says only "TSMC",
  "AAPL" or "the iPhone maker" fails the off-topic check, and a first word shared with other
  companies ("Deutsche" in "Deutsche Telekom") lets some of their headlines through.
- **Briefs know only headlines.** They say what was reported, not why or how much beyond
  what the title gives.
- **A run looks back one day.** Running less than daily loses the days in between.
- **A listing followed later** has no links to articles fetched before it, until the next
  articles arrive.
- **A brief older than 30 days loses its cited articles** when they are deleted; its text
  remains.
- Google News RSS has no API contract. When it changes, ingestion stops and the logs say
  so; stored articles and briefs remain.
