import type {
  InstrumentMatch,
  NormalizedArticle,
} from "@/features/ingestion/schemas/ingestion.schema";
import type { Instrument } from "@/features/instruments";

const CONFIDENCE = {
  finnhubSymbol: 1,
  rssMention: 0.7,
  rssBucket: 0.5,
} as const;

/**
 * Two-letter tickers (V, MC, OR, KO) collide with ordinary words, so free-text matching
 * only trusts tickers from three characters up. Shorter ones still match by company name.
 */
const MIN_TICKER_LENGTH = 3;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsTicker(text: string, ticker: string): boolean {
  if (ticker.length < MIN_TICKER_LENGTH) return false;
  return new RegExp(`(?<![A-Z0-9])${escapeRegex(ticker)}(?![A-Z0-9])`).test(text);
}

function mentionsName(text: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, "i").test(text);
}

/** Highest confidence wins when several rules point at the same instrument. */
function strongest(matches: readonly InstrumentMatch[]): InstrumentMatch[] {
  const best = new Map<string, InstrumentMatch>();

  for (const match of matches) {
    const current = best.get(match.instrumentId);
    if (!current || match.confidence > current.confidence) {
      best.set(match.instrumentId, match);
    }
  }

  return [...best.values()];
}

export function matchInstruments(
  article: NormalizedArticle,
  universe: readonly Instrument[],
): InstrumentMatch[] {
  if (article.origin.kind === "finnhub") {
    const ticker = article.origin.ticker.toUpperCase();
    const instrument = universe.find((candidate) => candidate.ticker === ticker);

    return instrument
      ? [
          {
            instrumentId: instrument.id,
            confidence: CONFIDENCE.finnhubSymbol,
            matchMethod: "finnhub-symbol",
          },
        ]
      : [];
  }

  const { macroBucket } = article.origin;
  const haystack = `${article.title} ${article.rawContent ?? ""}`;

  const bucketMatches: InstrumentMatch[] = universe
    .filter((candidate) => candidate.type === "etf" && candidate.macroBucket === macroBucket)
    .map((candidate) => ({
      instrumentId: candidate.id,
      confidence: CONFIDENCE.rssBucket,
      matchMethod: "rss-bucket",
    }));

  const mentionMatches: InstrumentMatch[] = universe
    .filter(
      (candidate) =>
        candidate.type === "stock" &&
        (mentionsTicker(haystack, candidate.ticker) || mentionsName(haystack, candidate.name)),
    )
    .map((candidate) => ({
      instrumentId: candidate.id,
      confidence: CONFIDENCE.rssMention,
      matchMethod: "rss-mention",
    }));

  return strongest([...bucketMatches, ...mentionMatches]);
}
