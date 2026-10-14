import type { Neighbour } from "@/features/ingestion/pipeline/dedup";
import {
  type Feed,
  FeedSchema,
  type InstrumentMatch,
  type NormalizedArticle,
} from "@/features/ingestion/schemas/ingestion.schema";
import type { Instrument } from "@/features/instruments";
import { INSTRUMENT_COLUMNS, toInstrument } from "@/features/instruments";
import { chunk, LOOKUP_CHUNK } from "@/shared/collections";
import { createSupabaseAdminClient } from "@/shared/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export function ingestionClient(): Admin {
  return createSupabaseAdminClient();
}

export async function loadActiveFeeds(db: Admin): Promise<Feed[]> {
  const { data, error } = await db
    .from("feeds")
    .select("id, url, source, macro_bucket")
    .eq("active", true);

  if (error) throw new Error(`Could not load feeds: ${error.message}`);

  return data.map((row) =>
    FeedSchema.parse({
      id: row.id,
      url: row.url,
      source: row.source,
      macroBucket: row.macro_bucket,
    }),
  );
}

export async function loadActiveInstruments(db: Admin): Promise<Instrument[]> {
  const { data, error } = await db
    .from("instruments")
    .select(INSTRUMENT_COLUMNS)
    .eq("active", true);

  if (error) throw new Error(`Could not load instruments: ${error.message}`);

  return data.map(toInstrument);
}

export async function findKnown(
  db: Admin,
  articles: readonly NormalizedArticle[],
): Promise<{ urls: Set<string>; hashes: Set<string> }> {
  const urls = new Set<string>();
  const hashes = new Set<string>();
  if (articles.length === 0) return { urls, hashes };

  for (const batch of chunk(articles, LOOKUP_CHUNK)) {
    const [byUrl, byHash] = await Promise.all([
      db
        .from("articles")
        .select("url, content_hash")
        .in(
          "url",
          batch.map((article) => article.url),
        ),
      db
        .from("articles")
        .select("url, content_hash")
        .in(
          "content_hash",
          batch.map((article) => article.contentHash),
        ),
    ]);

    const error = byUrl.error ?? byHash.error;
    if (error) throw new Error(`Could not check for existing articles: ${error.message}`);

    for (const row of [...(byUrl.data ?? []), ...(byHash.data ?? [])]) {
      urls.add(row.url);
      hashes.add(row.content_hash);
    }
  }

  return { urls, hashes };
}

export async function findNeighbours(
  db: Admin,
  embedding: readonly number[],
  since: Date,
): Promise<Neighbour[]> {
  const { data, error } = await db.rpc("match_articles", {
    query_embedding: JSON.stringify(embedding),
    since: since.toISOString(),
    match_count: 5,
  });

  if (error) throw new Error(`Near-duplicate lookup failed: ${error.message}`);

  return (data ?? []).map((row) => ({ id: row.id, distance: row.distance }));
}

export type ArticleToInsert = {
  readonly article: NormalizedArticle;
  readonly embedding: readonly number[];
  readonly canonicalArticleId: string | null;
  readonly matches: readonly InstrumentMatch[];
};

/**
 * `ignoreDuplicates` is what makes a re-run a no-op: the unique indexes on url and
 * content_hash absorb anything already stored, and nothing raises.
 */
export async function insertArticle(db: Admin, entry: ArticleToInsert): Promise<string | null> {
  const { data, error } = await db
    .from("articles")
    .upsert(
      {
        url: entry.article.url,
        source: entry.article.source,
        published_at: entry.article.publishedAt.toISOString(),
        title: entry.article.title,
        raw_content: entry.article.rawContent,
        content_hash: entry.article.contentHash,
        embedding: JSON.stringify(entry.embedding),
        canonical_article_id: entry.canonicalArticleId,
      },
      { onConflict: "url", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not insert article: ${error.message}`);
  if (!data) return null;

  if (entry.matches.length > 0) {
    const { error: matchError } = await db.from("article_instruments").upsert(
      entry.matches.map((match) => ({
        article_id: data.id,
        instrument_id: match.instrumentId,
        confidence: match.confidence,
        match_method: match.matchMethod,
      })),
      { onConflict: "article_id,instrument_id", ignoreDuplicates: true },
    );

    if (matchError) throw new Error(`Could not link instruments: ${matchError.message}`);
  }

  return data.id;
}
