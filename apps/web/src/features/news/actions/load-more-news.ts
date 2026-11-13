"use server";

import { z } from "zod";
import { NEWS_PAGE_SIZE, toNewsPage } from "@/features/news/data/instrument-news";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { logger } from "@/shared/logger";
import type { LoadMoreResult } from "@/types/news";

const PageRequestSchema = z.object({ instrumentId: z.uuid(), cursor: z.string().min(1) });

const FAILED: LoadMoreResult = { ok: false, message: "Could not load older news. Try again." };

export async function loadMoreNews(instrumentId: string, cursor: string): Promise<LoadMoreResult> {
  const parsed = PageRequestSchema.safeParse({ instrumentId, cursor });
  if (!parsed.success) return FAILED;

  const result = await resultOf(
    api.GET("/api/v1/instruments/{instrument_id}/news", {
      params: {
        path: { instrument_id: parsed.data.instrumentId },
        query: { limit: NEWS_PAGE_SIZE, cursor: parsed.data.cursor },
      },
    }),
  );
  if (result.ok) return { ok: true, page: toNewsPage(result.data) };

  const { status, code } = result.error;
  logger.warn("news.load_more_failed", { status, code, requestId: await currentRequestId() });
  return FAILED;
}
