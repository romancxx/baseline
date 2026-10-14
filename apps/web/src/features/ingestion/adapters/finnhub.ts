import { z } from "zod";
import type { RawArticle } from "@/features/ingestion/schemas/ingestion.schema";
import { logger } from "@/shared/logger";

const FinnhubArticleSchema = z.object({
  headline: z.string().min(1),
  url: z.url(),
  source: z.string().min(1),
  datetime: z.number().int().positive(),
  summary: z.string().default(""),
});

const FinnhubResponseSchema = z.array(z.unknown());

export type FinnhubParams = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly tickers: readonly string[];
  readonly from: string;
  readonly to: string;
};

/** Free tier allows 60 calls a minute; one ticker per call, so pace them. */
const REQUEST_SPACING_MS = 1100;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchFinnhubNews(params: FinnhubParams): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const [index, ticker] of params.tickers.entries()) {
    if (index > 0) await wait(REQUEST_SPACING_MS);

    const url = new URL("company-news", `${params.baseUrl}/`);
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    url.searchParams.set("token", params.apiKey);

    const response = await fetch(url, { headers: { accept: "application/json" } });

    if (!response.ok) {
      // One bad symbol must not sink the run; the summary line reports the gap.
      logger.warn("ingest.finnhub.request_failed", { ticker, status: response.status });
      continue;
    }

    const payload = FinnhubResponseSchema.parse(await response.json());
    let skipped = 0;

    for (const entry of payload) {
      const parsed = FinnhubArticleSchema.safeParse(entry);
      if (!parsed.success) {
        skipped += 1;
        continue;
      }

      articles.push({
        url: parsed.data.url,
        source: parsed.data.source,
        title: parsed.data.headline,
        publishedAt: new Date(parsed.data.datetime * 1000),
        rawContent: parsed.data.summary === "" ? null : parsed.data.summary,
        origin: { kind: "finnhub", ticker },
      });
    }

    logger.debug("ingest.finnhub.fetched", { ticker, kept: payload.length - skipped, skipped });
  }

  return articles;
}
