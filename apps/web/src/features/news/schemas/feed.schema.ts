import { z } from "zod";
import { InstrumentSchema } from "@/features/instruments";
import { TonalitySchema } from "@/features/summarization";

/** Why an instrument is in the feed. A held instrument that is also watched reads as held. */
export const FeedRelationSchema = z.enum(["holding", "watchlist"]);

export const FeedInstrumentSchema = z.object({
  instrument: InstrumentSchema,
  relation: FeedRelationSchema,
});

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
  instruments: z.array(FeedInstrumentSchema).min(1),
  tonality: TonalitySchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  provenance: ArticleProvenanceSchema,
});

/** Theme cards join this union, which is what keeps the feed itself unchanged. */
export const FeedItemSchema = z.discriminatedUnion("kind", [ArticleFeedItemSchema]);

/** The Review screen's `?filter=`; anything unrecognised shows everything. */
export const ReviewFilterSchema = z.enum(["all", "portfolio", "watchlist"]).catch("all");

export type FeedRelation = z.infer<typeof FeedRelationSchema>;
export type FeedInstrument = z.infer<typeof FeedInstrumentSchema>;
export type ArticleProvenance = z.infer<typeof ArticleProvenanceSchema>;
export type ArticleFeedItem = z.infer<typeof ArticleFeedItemSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type ReviewFilter = z.infer<typeof ReviewFilterSchema>;
