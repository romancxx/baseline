import { XMLParser } from "fast-xml-parser";
import type { Feed, RawArticle } from "@/features/ingestion/schemas/ingestion.schema";
import { logger } from "@/shared/logger";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const USER_AGENT = "stock-news/0.1 (+https://github.com)";

type FeedEntry = Record<string, unknown>;

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    return text((value as { "#text": unknown })["#text"]);
  }
  return null;
}

function link(entry: FeedEntry): string | null {
  const direct = text(entry.link);
  if (direct) return direct;

  // Atom puts the URL in an attribute, and may list several.
  const atom = entry.link;
  const candidates = Array.isArray(atom) ? atom : [atom];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && "@_href" in candidate) {
      const href = (candidate as { "@_href": unknown })["@_href"];
      if (typeof href === "string") return href;
    }
  }
  return text(entry.guid);
}

function publishedAt(entry: FeedEntry): Date | null {
  const raw = text(entry.pubDate) ?? text(entry.published) ?? text(entry.updated);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function entries(parsed: unknown): FeedEntry[] {
  const root = parsed as { rss?: { channel?: { item?: unknown } }; feed?: { entry?: unknown } };
  const raw = root.rss?.channel?.item ?? root.feed?.entry;

  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]) as FeedEntry[];
}

export async function fetchFeed(feed: Feed): Promise<RawArticle[]> {
  const response = await fetch(feed.url, {
    headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": USER_AGENT },
  });

  if (!response.ok) {
    logger.warn("ingest.rss.request_failed", { feed: feed.source, status: response.status });
    return [];
  }

  const parsed = parser.parse(await response.text());
  const articles: RawArticle[] = [];
  let skipped = 0;

  for (const entry of entries(parsed)) {
    const url = link(entry);
    const title = text(entry.title);
    const date = publishedAt(entry);

    if (!url || !title || !date) {
      skipped += 1;
      continue;
    }

    articles.push({
      url,
      source: feed.source,
      title,
      publishedAt: date,
      rawContent: text(entry.description) ?? text(entry.summary) ?? text(entry.content),
      origin: { kind: "rss", feedId: feed.id, macroBucket: feed.macroBucket },
    });
  }

  logger.debug("ingest.rss.fetched", { feed: feed.source, kept: articles.length, skipped });
  return articles;
}

export async function fetchFeeds(feeds: readonly Feed[]): Promise<RawArticle[]> {
  const results = await Promise.allSettled(feeds.map(fetchFeed));

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;

    logger.warn("ingest.rss.failed", {
      feed: feeds[index]?.source,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
    return [];
  });
}
