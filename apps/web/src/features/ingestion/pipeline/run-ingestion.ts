import { fetchFinnhubNews } from "@/features/ingestion/adapters/finnhub";
import { fetchFeeds } from "@/features/ingestion/adapters/rss";
import {
  findKnown,
  findNeighbours,
  ingestionClient,
  insertArticle,
  loadActiveFeeds,
  loadActiveInstruments,
} from "@/features/ingestion/data/ingestion-repository";
import { embed } from "@/features/ingestion/embeddings/embedder";
import { dedupeByHash, pickCanonical } from "@/features/ingestion/pipeline/dedup";
import { matchInstruments } from "@/features/ingestion/pipeline/match";
import { normalizeArticle } from "@/features/ingestion/pipeline/normalize";
import type { RawArticle } from "@/features/ingestion/schemas/ingestion.schema";
import { serverEnv } from "@/shared/config/server-env";
import { logger } from "@/shared/logger";

export type IngestionSummary = {
  fetched: number;
  afterHashDedup: number;
  alreadyStored: number;
  inserted: number;
  nearDuplicates: number;
  matches: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runIngestion(now: Date = new Date()): Promise<IngestionSummary> {
  const db = ingestionClient();
  const since = new Date(now.getTime() - serverEnv.INGEST_LOOKBACK_DAYS * DAY_MS);

  const [feeds, universe] = await Promise.all([loadActiveFeeds(db), loadActiveInstruments(db)]);
  logger.info("ingest.start", {
    feeds: feeds.length,
    instruments: universe.length,
    since: since.toISOString(),
  });

  const raw: RawArticle[] = [];

  if (serverEnv.FINNHUB_API_KEY) {
    const tickers = universe.filter((i) => i.type === "stock").map((i) => i.ticker);
    raw.push(
      ...(await fetchFinnhubNews({
        apiKey: serverEnv.FINNHUB_API_KEY,
        baseUrl: serverEnv.FINNHUB_BASE_URL,
        tickers,
        from: isoDate(since),
        to: isoDate(now),
      })),
    );
  } else {
    logger.warn("ingest.finnhub.skipped", { reason: "FINNHUB_API_KEY is not set" });
  }

  raw.push(...(await fetchFeeds(feeds)));

  // Sources overlap in what they carry but not in how far back they go; the window is
  // enforced here so every adapter is held to the same one.
  const inWindow = raw.filter((article) => article.publishedAt >= since);
  const normalized = dedupeByHash(inWindow.map(normalizeArticle));
  logger.info("ingest.normalized", { fetched: raw.length, unique: normalized.length });

  const known = await findKnown(db, normalized);
  const fresh = normalized.filter(
    (article) => !known.urls.has(article.url) && !known.hashes.has(article.contentHash),
  );
  logger.info("ingest.deduped", {
    alreadyStored: normalized.length - fresh.length,
    fresh: fresh.length,
  });

  const summary: IngestionSummary = {
    fetched: raw.length,
    afterHashDedup: normalized.length,
    alreadyStored: normalized.length - fresh.length,
    inserted: 0,
    nearDuplicates: 0,
    matches: 0,
  };

  if (fresh.length === 0) {
    logger.info("ingest.done", { ...summary });
    return summary;
  }

  const embeddings = await embed(fresh.map((article) => article.embeddingInput));

  for (const [index, article] of fresh.entries()) {
    const embedding = embeddings[index];
    if (!embedding) continue;

    const neighbours = await findNeighbours(db, embedding, since);
    const canonicalArticleId = pickCanonical(neighbours, serverEnv.NEAR_DUPLICATE_DISTANCE);
    const matches = matchInstruments(article, universe);

    const id = await insertArticle(db, {
      article,
      embedding,
      canonicalArticleId,
      matches,
    });

    if (id === null) continue;

    summary.inserted += 1;
    summary.matches += matches.length;
    if (canonicalArticleId !== null) summary.nearDuplicates += 1;
  }

  logger.info("ingest.done", { ...summary });
  return summary;
}
