# News source benchmark

Google News RSS was chosen ([0010](adr/0010-news-ingestion.md)) after three probes run on 30 and 31 October 2026, from a home connection, against six holdings: Apple (AAPL), Toyota (7203.T), LVMH (MC.PA), SAP (SAP.DE), ASML (ASML.AS) and TotalEnergies (TTE.PA).
Numbers are a snapshot of one day of news; they are meant to compare sources, not to measure them precisely.

## 1. Volume and coverage by source

30 Oct 2026, 11:26 UTC, last 3 days.
Each cell is the number of items returned, with the number whose title contains the company's name in brackets.

| Holding | Yahoo, by symbol | Yahoo, by name              | Google News, English | Google News, home language |
| ------- | ---------------- | --------------------------- | -------------------- | -------------------------- |
| AAPL    | 48 (20)          | 48 (20)                     | 100 (94)             | —                          |
| 7203.T  | 0                | 49 (30)                     | 100 (92)             | 43 (31)                    |
| MC.PA   | 0                | 45 (2 from the last 3 days) | 40 (20)              | 50 (11)                    |
| SAP.DE  | 0                | 0                           | 100 (95)             | 80 (77)                    |
| ASML.AS | 0                | 44 (21)                     | 45 (40)              | 36 (31)                    |
| TTE.PA  | 0                | 50 (32)                     | 100 (98)             | 100 (98)                   |

- **Yahoo by symbol returns nothing outside the US**, and nothing for SAP even by name.
  Where it does return items, they are often noise or stale: 18 of Apple's 48 were fund-flow posts ("iShares MSCI World ETF Buys $17.3 Million More Apple"), and only 2 of LVMH's 45 were from the last 3 days.
  Per-ticker news (`Ticker.news`) returned 0 items for every symbol in yfinance 1.7.0.
- **Google News covers every holding**, and reaches its 100-item cap over 3 days for the largest names.
- **A name in the title is not relevance.**
  "SAP Center" (an arena), Toyota car reviews and Apple product news all match.
  This is why relevance is left to the brief, not to ingestion.
- **Junk to drop at ingestion:** ad-hoc-news.de, YouTube links, quote and option pages, a title that was literally `META_TITLE_QUOTE`.

## 2. Finance relevance, and Finnhub for comparison

30 Oct 2026, last 3 days.
Each cell is the number of items, with the share of titles containing a finance word (shares, earnings, revenue, analyst… in the query's language) in brackets.
"Plain" queries the name alone; "finance" adds an `OR` group of finance terms.

| Holding | Google, English: plain → finance | Google, home language: plain → finance | Finnhub (US ticker) |
| ------- | -------------------------------- | -------------------------------------- | ------------------- |
| AAPL    | 100 (15%) → 100 (76%)            | —                                      | AAPL: 155 (45%)     |
| 7203.T  | 100 (10%) → 30 (56%)             | ja: 27 (3%) → 9 (11%)                  | TM: 17 (52%)        |
| MC.PA   | 39 (41%) → 18 (66%)              | fr: 26 (23%) → 22 (50%)                | —                   |
| SAP.DE  | 100 (19%) → 36 (63%)             | de: 81 (53%) → 60 (83%)                | SAP: 14 (42%)       |
| ASML.AS | 45 (48%) → 62 (87%)              | nl: 36 (11%) → 6 (33%)                 | ASML: 20 (70%)      |
| TTE.PA  | 100 (43%) → 100 (70%)            | fr: 100 (36%) → 66 (77%)               | TTE: 43 (51%)       |

The percentages are an upper bound on the gain: the finance query and the finance-word check use the same words, so the finance query partly scores itself.

- **Finance terms turn Google's results into company news** for English, French and German.
  Plain English queries are mostly product, car and arena news (Apple 15%, Toyota 10%, SAP 19%).
- **They can miss material stories that carry no finance word.**
  Three top plain results were not among the first 12 finance results: Toyota and Waymo's robotaxi deal, SAP replacing costly AI models to save about €2bn, and TotalEnergies cutting diesel prices (all Reuters).
  Google matches article text, so they may still be further down.
- **Finnhub's tags are loose.**
  Under TM: PACCAR, Lithia and Holley.
  Under SAP: partners' press releases.
  Under ASML: Samsung, TSMC and SK hynix.
  Under AAPL: Berkshire.
  Its publisher field says "Yahoo" for 113 of AAPL's 155 items, and its free plan covers North American companies only.
- **Japanese and Dutch return almost nothing:** Japanese titles write トヨタ, not "Toyota", and Dutch outlets cover ASML as local news.

## 3. Are headline-only briefs useful?

31 Oct 2026.
Google News headlines (English, finance terms, 40 per company, no article text) sent to the `claude` CLI with a draft brief prompt.

| Company       | Tone     | Headlines cited | Length (chars) | Gist                                                                                              |
| ------------- | -------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Apple         | mixed    | 9 of 40         | 595            | Overtakes Nvidia in value; Q4 results Monday; Bank of America warns on margins; South Korean fine |
| TotalEnergies | positive | 8 of 40         | 524            | Q3 profit up on refining; $5B buyback; dividend up 5.9%; EPS beat                                 |
| SAP           | mixed    | 9 of 40         | 566            | Guidance lifted; cheaper AI models to save about €2bn; NTT cloud deal; upgraded to Buy by Erste   |
| LVMH          | mixed    | 5 of 40         | 505            | Luxury shares plunge; China weakness; new Louis Vuitton creative officer; missing Hermès shares   |

The briefs were concrete and attributed, and dropped off-topic headlines.
The SAP brief caught the AI-models story the finance query seemed to miss in probe 2.
What went wrong, and is now handled by the prompt or recorded as a limit:

- **Conflicting headlines got one side:** TotalEnergies' revenue "topped estimates" and "missed"; the brief reported only the miss.
  The prompt now asks to name both.
- **Inferred facts:** "this Monday" became "Monday, Nov. 2".
  The prompt now forbids computing dates or figures; the ID check cannot catch this.
- **Tone is subjective:** LVMH came out "mixed" from mostly negative headlines.
  The prompt now defines "mixed" more strictly.
- **ad-hoc-news.de** was 5 of SAP's 9 citations, including the only source for the guidance raise.
  Excluding it, as decided, can leave a brief thinner.
- The probe used the CLI's default model, not the production model, so its quality is an upper bound.

## Conclusion

- **Google News RSS** is the only free source that covered every holding, in volume.
  With finance terms, most results are company news.
- **Yahoo news** is unusable outside the US and noisy inside it: not a source.
- **Finnhub** is finance-focused but US-only on the free plan, with loose tags and no useful publisher.
  It stays the planned second source behind the `NewsSource` interface.
- **English only for v1** is a scope decision.
  The probes show French and German would add volume; Dutch and Japanese would need aliases in local script first.
- **Headlines are enough for a useful brief**, so article text is not fetched in v1.
