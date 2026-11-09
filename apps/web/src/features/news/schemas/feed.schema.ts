import { z } from "zod";
import { InstrumentSchema } from "@/features/instruments";
import { ToneSchema } from "@/features/news/schemas/tone.schema";

/** What produced each part of a card, so nothing claims to be generated that was not. */
export const ArticleProvenanceSchema = z.object({
  source: z.string().min(1),
  publishedAt: z.date(),
  model: z.string().min(1).nullable(),
  generatedAt: z.date().nullable(),
});

export const ArticleFeedItemSchema = z.object({
  kind: z.literal("article"),
  id: z.uuid(),
  title: z.string().min(1),
  url: z.url(),
  /** The outlet's own standfirst. Not generated, and not a summary. */
  teaser: z.string().min(1).nullable(),
  instruments: z.array(InstrumentSchema).min(1),
  tone: ToneSchema.nullable(),
  provenance: ArticleProvenanceSchema,
});

/** Theme cards join this union, which is what keeps the feed itself unchanged. */
export const FeedItemSchema = z.discriminatedUnion("kind", [ArticleFeedItemSchema]);

export type ArticleProvenance = z.infer<typeof ArticleProvenanceSchema>;
export type ArticleFeedItem = z.infer<typeof ArticleFeedItemSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
