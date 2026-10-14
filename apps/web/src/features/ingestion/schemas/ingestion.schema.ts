import { z } from "zod";

export const FeedSeedSchema = z.object({
  url: z.url(),
  source: z.string().trim().min(1),
  macro_bucket: z.string().trim().min(1),
});

export const FeedSeedListSchema = z.array(FeedSeedSchema).min(1);

export const FeedSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  source: z.string().min(1),
  macroBucket: z.string().min(1),
});

/** Where an article came from, which is what the matcher reasons about. */
export const ArticleOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("finnhub"), ticker: z.string().min(1) }),
  z.object({ kind: z.literal("rss"), feedId: z.uuid(), macroBucket: z.string().min(1) }),
]);

/** An article as an adapter hands it over: source-shaped, not yet hashed or embedded. */
export const RawArticleSchema = z.object({
  url: z.url(),
  source: z.string().trim().min(1),
  title: z.string().trim().min(1),
  publishedAt: z.date(),
  rawContent: z.string().nullable(),
  origin: ArticleOriginSchema,
});

export const NormalizedArticleSchema = RawArticleSchema.extend({
  contentHash: z.string().length(64),
  embeddingInput: z.string().min(1),
});

export const InstrumentMatchSchema = z.object({
  instrumentId: z.uuid(),
  confidence: z.number().min(0).max(1),
  matchMethod: z.enum(["finnhub-symbol", "rss-bucket", "rss-mention"]),
});

export type FeedSeed = z.infer<typeof FeedSeedSchema>;
export type Feed = z.infer<typeof FeedSchema>;
export type ArticleOrigin = z.infer<typeof ArticleOriginSchema>;
export type RawArticle = z.infer<typeof RawArticleSchema>;
export type NormalizedArticle = z.infer<typeof NormalizedArticleSchema>;
export type InstrumentMatch = z.infer<typeof InstrumentMatchSchema>;
