import { z } from "zod";
import { InstrumentTickerSchema } from "@/features/instruments";

export const TonalitySchema = z.enum(["bullish", "neutral", "bearish"]);

/**
 * What the model is asked to return. The API constrains the response to this shape, so
 * this schema is also the contract sent over the wire — keep it flat and unambiguous.
 */
export const ModelOutputSchema = z.object({
  tonality: TonalitySchema,
  confidence: z.number().min(0).max(1),
  instruments_mentioned: z.array(z.string()).max(20),
});

/**
 * The rules the API cannot enforce: a ticker list that is actually tickers, and one no
 * longer than the article could justify. Applied after the response validates.
 */
export const VerifiedOutputSchema = ModelOutputSchema.extend({
  instruments_mentioned: z
    .array(InstrumentTickerSchema)
    .max(20)
    .transform((tickers) => [...new Set(tickers)]),
});

export type Tonality = z.infer<typeof TonalitySchema>;
export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type VerifiedOutput = z.infer<typeof VerifiedOutputSchema>;

export const ArticleToSummarizeSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  source: z.string().min(1),
  body: z.string().nullable(),
});

export type ArticleToSummarize = z.infer<typeof ArticleToSummarizeSchema>;

export type SummaryRecord = {
  readonly articleId: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly tonality: Tonality;
  readonly confidence: number;
  readonly instrumentsMentioned: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
};
