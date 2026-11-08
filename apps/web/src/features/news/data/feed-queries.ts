import type { Instrument } from "@/features/instruments";
import { type FeedItem, FeedItemSchema } from "@/features/news/schemas/feed.schema";
import { chunk, LOOKUP_CHUNK } from "@/shared/collections";
import { createSupabaseServerClient } from "@/shared/supabase/server";

export const FEED_LIMIT = 50;

// The summaries written by the retired web pipeline, which the feed reads until it moves
// onto the API's briefs.
const SUMMARY_MODEL = "claude-haiku-4-5";
const SUMMARY_PROMPT_VERSION = "v1";

const ARTICLE_COLUMNS =
  "id, title, url, source, published_at, raw_content, article_instruments!inner(instrument_id)";

export type FeedQuery = {
  /** The instruments to show, resolved by the route from holdings. */
  readonly instruments: readonly Instrument[];
  readonly limit?: number;
};

type SummaryRow = {
  article_id: string;
  tonality: "bullish" | "neutral" | "bearish";
  confidence: number | null;
  model: string;
  generated_at: string;
};

/** Any client carrying a user's session; RLS scopes every read through it. */
export type FeedReader = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Tonality for one model and prompt only, keyed by article. */
async function loadSummaries(
  supabase: FeedReader,
  articleIds: readonly string[],
): Promise<Map<string, SummaryRow>> {
  const byArticle = new Map<string, SummaryRow>();

  for (const batch of chunk(articleIds, LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from("summaries")
      .select("article_id, tonality, confidence, model, generated_at")
      .eq("model", SUMMARY_MODEL)
      .eq("prompt_version", SUMMARY_PROMPT_VERSION)
      .in("article_id", batch);

    if (error) {
      throw new Error(`Could not load summaries: ${error.message}`);
    }

    for (const row of data) {
      byArticle.set(row.article_id, row);
    }
  }

  return byArticle;
}

/**
 * Canonical articles touching any of the given instruments, most recently published first.
 * One card per article however many of the instruments it matched.
 */
export async function listFeed(query: FeedQuery): Promise<readonly FeedItem[]> {
  return listFeedWith(await createSupabaseServerClient(), query);
}

/** `listFeed` with the reader supplied, so tests can drive it as a real signed-in user. */
export async function listFeedWith(
  supabase: FeedReader,
  query: FeedQuery,
): Promise<readonly FeedItem[]> {
  if (query.instruments.length === 0) {
    return [];
  }

  const byInstrumentId = new Map(
    query.instruments.map((instrument) => [instrument.id, instrument] as const),
  );

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .is("canonical_article_id", null)
    .in("article_instruments.instrument_id", [...byInstrumentId.keys()])
    .order("published_at", { ascending: false })
    .limit(query.limit ?? FEED_LIMIT);

  if (error) {
    throw new Error(`Could not load the feed: ${error.message}`);
  }

  const summaries = await loadSummaries(
    supabase,
    data.map((row) => row.id),
  );

  return data.flatMap((row) => {
    const matched = row.article_instruments
      .map((link) => byInstrumentId.get(link.instrument_id))
      .filter((instrument): instrument is Instrument => instrument !== undefined);

    if (matched.length === 0) {
      return [];
    }

    const summary = summaries.get(row.id);
    const teaser = row.raw_content?.trim();

    return FeedItemSchema.parse({
      kind: "article",
      id: row.id,
      title: row.title,
      url: row.url,
      teaser: teaser === undefined || teaser === "" ? null : teaser,
      instruments: matched,
      tonality: summary?.tonality ?? null,
      confidence: summary?.confidence ?? null,
      provenance: {
        source: row.source,
        publishedAt: new Date(row.published_at),
        model: summary?.model ?? null,
        generatedAt: summary ? new Date(summary.generated_at) : null,
      },
    });
  });
}
