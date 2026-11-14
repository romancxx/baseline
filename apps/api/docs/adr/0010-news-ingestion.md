# 10. News ingestion

- **Status:** accepted
- **Date:** 2026-10-29

## Context

Baseline tells a user what was reported about the securities they hold ([0009](0009-portfolios.md)): a short brief per security, with a tone and the headlines behind it.
Like market data ([0007](0007-market-data.md)), it runs on one machine, for personal use, at almost no cost.

The web prototype built a first pipeline, and its records hold what live runs taught ([old web 0004](https://github.com/romancxx/baseline/blob/e476ac1/apps/web/docs/adr/0004-ingestion-pipeline.md), [0005](https://github.com/romancxx/baseline/blob/e476ac1/apps/web/docs/adr/0005-summarization-and-tonality.md), [0006](https://github.com/romancxx/baseline/blob/e476ac1/apps/web/docs/adr/0006-home-feed.md)):

- Feed teasers average 260 characters, too short to summarise; summaries need the article's text.
- A ticker tag is a candidate, not proof: Finnhub files a Berkshire earnings piece under `AAPL`.
- Regex mentions over headline and teaser found 9 links in 941 articles.
- Embedding distance cannot tell "same story, other outlet" from "same stock, other story".
- A small model costs cents a day; batching and prompt caching did not pay.

This record keeps one source and one model call per security.
What it leaves out (more sources, article text, model-confirmed links, a scheduler, digests) is in [improvements.md](../improvements.md), each with when it becomes worth doing.

## Probes

Throwaway scripts queried six stocks (AAPL, MC.PA, TTE.PA, SAP.DE, ASML.AS, 7203.T) on 2026-10-30 and 31.

- **Yahoo search news has nothing outside the US**: 0 items for each of the five non-US symbols.
- **Finnhub's tags are loose**: PACCAR under `TM`, Samsung and TSMC under `ASML`, Berkshire's portfolio under `AAPL`.
  Its free plan covers North American listings only.
- **A plain name query is mostly not finance**, and finance terms in the query fix most of it.
  The share of titles with a finance word:

  | Stock         | Plain: items (finance share) | With finance terms |
  | ------------- | ---------------------------- | ------------------ |
  | Apple         | 100 (15%)                    | 100 (76%)          |
  | Toyota        | 100 (10%)                    | 30 (56%)           |
  | LVMH          | 39 (41%)                     | 18 (66%)           |
  | SAP           | 100 (19%)                    | 36 (63%)           |
  | ASML          | 45 (48%)                     | 62 (87%)           |
  | TotalEnergies | 100 (43%)                    | 100 (70%)          |

  The query and the check use the same words, so the gain is an upper bound.
- **Material stories without finance words fall out**: Reuters on Toyota and Waymo's robotaxi deal was in no finance query's first 12 results.
- **Finance terms bring their own junk**: option-contract, tokenized-stock, quote and chart pages, and one aggregator (ad-hoc-news.de, 16 of SAP's 36 items).
- **Headline-only briefs are usable**: 4 sentences, attributed, with no advice, citing 5 to 9 headlines and no number outside the input.
  They gave one side of conflicting headlines, and cited both of two near-identical ones.

## Sources

- **One source: Google News RSS search**, in English (`hl=en-US&gl=US&ceid=US:en`).
  It covers European and Asian companies, which Finnhub's free plan and Yahoo do not.
  Other languages are out of scope.
- **Sources sit behind a `NewsSource` protocol** in the news module's `service.py`: a `source` attribute, recorded on each article, and `async fetch(query: NewsQuery) -> FetchResult`.
  A `NewsQuery` is a security's name and a start time; a `FetchResult` holds the `RawArticle`s (URL, title, publisher, publication time) and the items dropped, by reason.
  A source raises `ProviderUnavailableError` when it cannot be reached; tests use a `FakeNewsSource`.
- **A source is a client and an adapter.**
  `integrations/google_news/` speaks Google's language: a query in, parsed feed items out, fetched with `httpx2` and handed to feedparser as a stream, since given bytes or a string feedparser first tries to open it as a path or a URL.
  `GoogleNewsSource`, in the news module's `sources.py`, builds the query, drops junk, off-topic and too-old items, and maps the rest to `RawArticle`s.
  Integrations cannot import modules, so the adapter keeps the client unaware of `NewsQuery` and `RawArticle`.
- **Requests are few and spaced**: one per security group, a second apart, with a User-Agent naming the app.
  Only the command uses the client, so it creates and closes it; it is not in the lifespan.

Rejected:
Finnhub alone (no European or Asian news on the free plan; it is the planned second source).
Yahoo search news (nothing outside the US).
GDELT and publisher feeds (more parsers and noise).
NewsAPI (development-only free plan).
Paid feeds (a cost for a personal app).
The adapter inside `service.py`, or the protocol in `core/` (Google code beside the ingest logic, or `core/` knowing about news).

## Queries

- **One query per security, not per listing.**
  Followed stocks are grouped by `share_class_figi`, and an instrument without one is its own group: MC.PA and MOH.DE cost one query.
- **The name as an exact phrase, plus finance terms, over the last day**: `"LVMH Moët Hennessy - Louis Vuitton" (shares OR stock OR earnings OR results OR revenue OR analyst OR investors) when:1d`.
  The name is the group's first-stored listing's, without its legal forms: `news_name` strips them from the end until none is left ("Samsung Electronics Co., Ltd." gives "Samsung Electronics").
- **Stocks only.**
  Nothing reports on "an MSCI World ETF".

Rejected:
The plain name (mostly not finance).
Plain and finance queries both (twice the requests, for results a brief should mostly leave out).
`when:3d` (hit the 100-item cap).
Queries in the home market's language (out of scope).

## Filtering and deduplication

- **Junk is dropped before storage** by `drop_junk` in the integration, counted by reason.
  `excluded_domain` covers ad-hoc-news.de, youtube.com, imdb.com and cryptorank.io, read from the item's `<source url>` since links are not decoded.
  Pages that are not articles are recognised by title: `quote_page`, `chart_page`, `option_page`, `derivative_page`, with patterns from feeds recorded on 2026-10-31.
- **An item whose title does not name the security is `off_topic`.**
  Google matches the phrase anywhere in the article, so market roundups come back too.
  The title must contain the news name's first word as a whole word, ignoring case and accents: "ASML" matches, "ASM International" does not.
- **Google's links are stored as they are**: decoding takes a request per item to an endpoint that rate-limits.
- **Duplicates are stored once.**
  `articles.url` is unique.
  `title_key(title, publisher)` is the title casefolded, accent-folded, without Google's " - Publisher" suffix, with runs of punctuation and spaces made one space; an article whose key matches one published within 3 days is the same article.
  A duplicate adds its links to the stored article.
- **Runs are idempotent**: inserts use `ON CONFLICT DO NOTHING` on the URL and the links' key, and no transaction stays open during a network call.
- **A group that fails is logged and skipped.**
  Each group's articles and links are stored in one transaction, and the run logs one `news.ingest_finished` line.

Rejected:
Decoding and normalising links (a request per item).
Near-duplicates by trigram similarity or text hash (needs a labelled sample to tune).
Embeddings (see the context).
Publisher tiers (a brief over 40 headlines does not need them).

## Matching and storage

- **An article is linked to every followed instrument of the group it was fetched for**: the query is the match.
  A security's news is read through any of its listings' links.
- **`articles`**: `id`, `source` (enum), `url` (unique), `title`, `title_key`, `publisher`, `published_at`, `created_at`, all text as `text`.
  An index on `(title_key, published_at)` serves the duplicate check.
- **`article_instruments`**: `(article_id, instrument_id)` and `created_at`, cascading from both sides.
- **`briefs`**: `group_key` (the share class FIGI, or the id of an instrument without one), `text`, `tone` (enum), `model` (`api:claude-haiku-5-5`), `prompt_version`, `input_tokens` and `output_tokens` (summed over attempts, null when the backend reports none), `period_start` and `period_end` (the oldest and newest headline sent) and `generated_at`.
  An index on `(group_key, generated_at)` serves the latest-brief lookup.
- **`brief_articles`**: `(brief_id, article_id)`, the cited articles, cascading from both sides.
- **No article text or teasers**; Google's teaser repeats the title.
- **Articles are kept 30 days**: each ingest run ends by deleting older ones, with their links.

Rejected:
Name and ticker matching across all articles with model-confirmed links (needed only with several sources or untargeted feeds).
One link per security read through `share_class_figi` (a late FIGI would need its links moved).
A tone per article (a call per article).
A `brief_instruments` table (a row per listing for what `group_key` says in one column).

## Briefs

- **One model call per security group**, over its at most 40 most recent articles of the last 3 days, newest first, each numbered with its headline, publisher and time, after the security's name.
  The model cites numbers, which are mapped back to article ids: shorter and harder to garble than UUIDs.
- **The model** is `claude-haiku-5-5` (the `ANTHROPIC_MODEL` setting) at effort `low`, through the official SDK in `integrations/anthropic/`, or the local `claude` CLI ([0011](0011-local-llm-backend.md)).
  The answer is constrained by the output model's JSON schema and validated again with Pydantic; one that does not validate or did not end normally raises `InvalidOutputError`.
  The SDK retries rate limits, overloads and dropped connections twice; what still fails raises `ProviderUnavailableError`.
  Without a backend, the command logs `skipped` and exits 0.
- **The output** is 1 to 5 sentences, at most about 600 characters, attributed ("Reuters reports…"), only what the headlines say, naming both sides when outlets disagree; a tone; the cited numbers.
  The text is empty when no headline bears on the business, and nothing is stored: no brief is better than filler.
- **Tone** is `positive`, `negative`, `neutral` or `mixed`: how the reported facts bear on the company, not on its share price, which is why "bullish" and "bearish" are not used.
- **Briefs never advise.**
  The prompt forbids recommending, rating or predicting in the brief's own voice; an analyst's rating change is reported as a fact.
  The response carries a fixed disclaimer: "Describes news as reported. Not investment advice."
- **The prompt's rules come from the probes and the first live run**: only what the headlines say; dates and figures repeated as written, never computed; headlines not about the company ignored; no padding with items that do not bear on the business, and no comments on the headlines themselves.
- **Checks in code** follow the schema's: at least one citation, every cited number in the list, 40 to 700 characters, and a deny-list of second person, "should buy" and the like, and "investors should".
  Forecasts are left to the prompt: a phrase cannot tell "Jefferies set a price target of $250" from the brief's own voice.
- **A draft that fails gets one corrective retry**, with the rejected text and every reason.
  A second failure is logged and nothing is stored; the previous brief stays.
- **A brief is regenerated only when new articles arrived**: one published after the newest headline of the group's latest brief.
  Older briefs are kept.
- **`PROMPT_VERSION`** is stored with each brief, and raised with every prompt change.
- **The provenance line is computed when a brief is read**, as a Pydantic computed field of `BriefRead`: the count of cited articles still stored, the UTC days of the headlines, and `generated_at` ("From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC").
- **Cost**: about 2,500 input and 400 output tokens, about $0.0005 a brief, 1.5 cents for 30 securities.

Rejected:
Per-article summaries from extracted text (better briefs, but a fetcher, paywall handling and a call per article).
Summarising teasers (they repeat the title).
The `claude` CLI as the only backend (about 10 s a call, tied to a signed-in machine; it is the second backend instead).
A local model through Ollama (slow on a laptop).
Sonnet (20 times the price for a task Haiku should handle).
Storing rejected briefs (a status column for rows nothing shows).

## Running

- **Commands only**: `python -m app.jobs.ingest_news` (`just ingest-news`) and `python -m app.jobs.generate_briefs` (`just brief`), wired as in [0002](0002-api-architecture.md).
  No scheduler, digests or email.
- **`GET /instruments/{id}/brief`** returns the latest brief of the instrument's share class (by `generated_at`, then `id`), with its cited articles, provenance and disclaimer, or 404.
  Any listing works, followed or not: MOH.DE shows what was fetched for MC.PA.
- **`GET /instruments/{id}/news`** returns the share class's articles, newest published first, keyset-paginated on `(published_at, id)`.
- **`GET /portfolio/briefs`** returns each held security group with its held listings and latest brief, or `null`, read in one `DISTINCT ON (group_key)` query.
  ETF groups have `news_collected: false`, so a client tells "no news for ETFs" from "no brief yet".
  It is not paginated: a personal portfolio holds tens of securities, as for the overview ([0009](0009-portfolios.md)).
- **Cited articles load with the brief** through a read-only `selectin` relationship over `brief_articles`; the job writes citations as `BriefArticle` rows.

Rejected:
A `GET /news` feed over every followed security (deferred until a home feed needs it).
One endpoint with the brief and its 40 input headlines (no way to read older articles).
Paginating news on `created_at` (the order of storage, not of publication).
The web calling the instrument endpoint once per holding (a request each, and the grouping and stocks-only rule copied into the browser).
Leaving ETFs out of the portfolio's briefs (a held ETF would look like a stock still waiting for its brief).

## Evaluation

A week of daily runs checks the design before it is relied on: articles per group, dropped and merged items, brief failures and token cost, and a hand check of about 20 briefs for facts not in their cited headlines and material stories missed.
A finding that calls for a change becomes a row in [improvements.md](../improvements.md).

## Out of scope

News in other languages; news for ETFs and indices, and market-wide news; real-time alerts and links between news and price moves; social media, paid news APIs and regulatory filings; getting past paywalls.

## Consequences

- **Material stories without finance words can be missed**, such as the Toyota and Waymo deal.
- **Recall depends on one name per security**: an official name the press shortens ("LVMH Moët Hennessy - Louis Vuitton" for "LVMH") finds little as an exact phrase.
- **A title that names the company another way is dropped** ("TSMC", "AAPL", "the iPhone maker"), and a first word shared with other companies ("Deutsche") lets some of their headlines through.
- **Briefs know only headlines**: what was reported, not why.
- **A run looks back one day**, so running less than daily loses the days in between.
- **A listing followed later** has no links to articles fetched before it.
- **A brief older than 30 days loses its cited articles**; its text remains.
- **Google News RSS has no API contract.**
  When it changes, ingestion stops and the logs say so; stored articles and briefs remain.
