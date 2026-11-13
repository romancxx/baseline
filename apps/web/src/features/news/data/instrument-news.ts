import type { components } from "@/shared/api/api.types";
import { api, dataOrNull, dataOrThrow } from "@/shared/api/request";
import type { Article, Brief, NewsPage } from "@/types/news";

export const NEWS_PAGE_SIZE = 10;

export function toArticle(read: components["schemas"]["ArticleRead"]): Article {
  return {
    id: read.id,
    title: read.title,
    publisher: read.publisher,
    publishedAt: read.published_at,
    url: read.url,
  };
}

export function toNewsPage(page: components["schemas"]["Page_ArticleRead_"]): NewsPage {
  return { articles: page.items.map(toArticle), nextCursor: page.next_cursor };
}

/** `null` when no brief has been written for the listing's security yet. */
export async function getLatestBrief(instrumentId: string): Promise<Brief | null> {
  const brief = await dataOrNull(
    "load the latest brief",
    api.GET("/api/v1/instruments/{instrument_id}/brief", {
      params: { path: { instrument_id: instrumentId } },
    }),
  );
  if (brief === null) return null;

  return {
    text: brief.text,
    tone: brief.tone,
    articles: brief.articles.map(toArticle),
    provenance: brief.provenance,
    disclaimer: brief.disclaimer,
  };
}

export async function listNews(instrumentId: string): Promise<NewsPage> {
  const page = await dataOrThrow(
    "load the news",
    api.GET("/api/v1/instruments/{instrument_id}/news", {
      params: { path: { instrument_id: instrumentId }, query: { limit: NEWS_PAGE_SIZE } },
    }),
  );
  return toNewsPage(page);
}
