import { describe, expect, it } from "vitest";
import { matchInstruments } from "@/features/ingestion/pipeline/match";
import { normalizeArticle } from "@/features/ingestion/pipeline/normalize";
import type { ArticleOrigin } from "@/features/ingestion/schemas/ingestion.schema";
import type { Instrument } from "@/features/instruments";

const id = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;

const universe: readonly Instrument[] = [
  { id: id(1), ticker: "AAPL", isin: null, name: "Apple", type: "stock", macroBucket: "big-tech" },
  { id: id(2), ticker: "V", isin: null, name: "Visa", type: "stock", macroBucket: "financials" },
  { id: id(3), ticker: "NVDA", isin: null, name: "NVIDIA", type: "stock", macroBucket: "semis" },
  {
    id: id(4),
    ticker: "SPY",
    isin: null,
    name: "SPDR S&P 500 ETF Trust",
    type: "etf",
    macroBucket: "broad-market-etf",
  },
  {
    id: id(5),
    ticker: "QQQ",
    isin: null,
    name: "Invesco QQQ Trust",
    type: "etf",
    macroBucket: "broad-market-etf",
  },
  {
    id: id(6),
    ticker: "SMH",
    isin: null,
    name: "VanEck Semiconductor ETF",
    type: "etf",
    macroBucket: "semis",
  },
];

function article(title: string, origin: ArticleOrigin, content: string | null = null) {
  return normalizeArticle({
    url: "https://example.com/a",
    source: "Example",
    title,
    publishedAt: new Date("2026-09-11T10:00:00Z"),
    rawContent: content,
    origin,
  });
}

const rssOrigin: ArticleOrigin = {
  kind: "rss",
  feedId: id(9),
  macroBucket: "broad-market-etf",
};

describe("finnhub origin", () => {
  it("matches the requested symbol at full confidence", () => {
    const matches = matchInstruments(
      article("Anything", { kind: "finnhub", ticker: "AAPL" }),
      universe,
    );

    expect(matches).toEqual([
      { instrumentId: id(1), confidence: 1, matchMethod: "finnhub-symbol" },
    ]);
  });

  it("is case-insensitive on the symbol", () => {
    expect(
      matchInstruments(article("x", { kind: "finnhub", ticker: "aapl" }), universe),
    ).toHaveLength(1);
  });

  it("returns nothing for a symbol outside the universe", () => {
    expect(matchInstruments(article("x", { kind: "finnhub", ticker: "GME" }), universe)).toEqual(
      [],
    );
  });
});

describe("rss origin", () => {
  it("links every active ETF in the feed's bucket", () => {
    const matches = matchInstruments(article("Stocks slip on rate fears", rssOrigin), universe);

    expect(matches.map((match) => match.instrumentId).sort()).toEqual([id(4), id(5)]);
    expect(matches.every((match) => match.matchMethod === "rss-bucket")).toBe(true);
  });

  it("does not link ETFs from another bucket", () => {
    const matches = matchInstruments(article("Stocks slip", rssOrigin), universe);

    expect(matches.map((match) => match.instrumentId)).not.toContain(id(6));
  });

  it("also matches a stock named in the text", () => {
    const matches = matchInstruments(
      article("Apple beats estimates as iPhone sales rise", rssOrigin),
      universe,
    );
    const apple = matches.find((match) => match.instrumentId === id(1));

    expect(apple).toEqual({ instrumentId: id(1), confidence: 0.7, matchMethod: "rss-mention" });
  });

  it("matches a stock by ticker when it is long enough", () => {
    const matches = matchInstruments(article("NVDA leads chip rally", rssOrigin), universe);

    expect(matches.some((match) => match.instrumentId === id(3))).toBe(true);
  });

  it("ignores two-letter tickers, which collide with ordinary words", () => {
    const matches = matchInstruments(
      article("Rates V shaped recovery in focus", rssOrigin),
      universe,
    );

    expect(matches.some((match) => match.instrumentId === id(2))).toBe(false);
  });

  it("does not match a ticker embedded in a longer word", () => {
    const matches = matchInstruments(article("NVDAX fund launches", rssOrigin), universe);

    expect(matches.some((match) => match.instrumentId === id(3))).toBe(false);
  });

  it("keeps the strongest rule when two point at one instrument", () => {
    const withEtfMention = matchInstruments(
      article("Invesco QQQ Trust sees record inflows", rssOrigin),
      universe,
    );
    const qqq = withEtfMention.filter((match) => match.instrumentId === id(5));

    expect(qqq).toHaveLength(1);
  });
});
