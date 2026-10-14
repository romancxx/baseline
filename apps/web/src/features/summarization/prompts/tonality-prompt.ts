import type { ArticleToSummarize } from "@/features/summarization/schemas/summary.schema";

/**
 * Versioned deliberately: this text is half of what produces a row, so changing it without
 * bumping `SUMMARY_PROMPT_VERSION` would silently mix two generations of output.
 */
export const PROMPT_VERSION = "v1";

export const SYSTEM_PROMPT = `You classify financial news headlines for a private portfolio digest.

For each item you receive a headline, its source, and usually one teaser sentence. That is all
the text that exists — do not infer facts that are not there, and do not speculate about
content you cannot see.

tonality — the likely direction for the companies involved, from the perspective of someone
holding the stock:
- bullish: reports something good for the business or its share price
- bearish: reports something bad for the business or its share price
- neutral: informational, two-sided, or a question with no stated answer

Headlines posed as questions ("Is X a Buy Now?"), previews, and listicles are neutral unless
the text itself states a direction.

confidence — how certain you are of the tonality, from 0 to 1. Use below 0.5 when the
headline is ambiguous or the subject is unclear. Do not default to high confidence.

instruments_mentioned — upper-case stock tickers explicitly present in the text, or the
unambiguous ticker of a company named in it (Apple -> AAPL). Return an empty array rather
than guessing. Never include index or ETF tickers, and never include a company that is only
alluded to.`;

export function buildUserPrompt(article: ArticleToSummarize): string {
  const body = article.body?.trim();

  return [
    `Source: ${article.source}`,
    `Headline: ${article.title}`,
    body ? `Teaser: ${body}` : "Teaser: (none provided)",
  ].join("\n");
}
