"use client";

import { useState, useTransition } from "react";
import { NewsRow } from "@/features/news/components/row/news-row";
import { FormError } from "@/shared/ui/display/form-error";
import { Button } from "@/shared/ui/form/button";
import type { LoadMoreNews, NewsPage } from "@/types/news";

export type InstrumentNewsListProps = {
  readonly instrumentId: string;
  readonly firstPage: NewsPage;
  readonly loadMoreNews: LoadMoreNews;
};

/** The first page comes from the server; "Load more" appends older pages below it. */
export function InstrumentNewsList({
  instrumentId,
  firstPage,
  loadMoreNews,
}: InstrumentNewsListProps) {
  const [articles, setArticles] = useState(firstPage.articles);
  const [cursor, setCursor] = useState(firstPage.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function loadMore(from: string) {
    startLoading(async () => {
      const result = await loadMoreNews(instrumentId, from);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setArticles((shown) => [...shown, ...result.page.articles]);
      setCursor(result.page.nextCursor);
    });
  }

  if (articles.length === 0) {
    return <p className="text-detail text-secondary">No news about this security yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul>
        {articles.map((article) => (
          <NewsRow key={article.id} article={article} />
        ))}
      </ul>
      {error === null ? null : <FormError message={error} />}
      {cursor === null ? null : (
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => loadMore(cursor)}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
