import { toInstrument } from "@/features/instruments/server";
import { toBrief } from "@/features/news/data/instrument-news";
import { api, dataOrThrow } from "@/shared/api/request";
import type { SecurityBrief } from "@/types/news";

/**
 * The latest brief of each security held, in the API's order: newest brief first, then those
 * without one by name.
 */
export async function listPortfolioBriefs(): Promise<readonly SecurityBrief[]> {
  const { items } = await dataOrThrow("load the briefs", api.GET("/api/v1/portfolio/briefs"));

  return items.flatMap(({ key, name, instruments, news_collected, brief }) => {
    const [first, ...others] = instruments.map(toInstrument);
    if (first === undefined) return [];

    return [
      {
        key,
        name,
        listings: [first, ...others],
        newsCollected: news_collected,
        brief: brief === null ? null : toBrief(brief),
      },
    ];
  });
}
