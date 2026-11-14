import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InstrumentNewsList } from "@/features/news/components/list/instrument-news-list";
import type { Article, LoadMoreNews, NewsPage } from "@/types/news";

const INSTRUMENT_ID = "a1111111-1111-4111-8111-111111111111";

function article(n: number): Article {
  return {
    id: `b2222222-2222-4222-8222-22222222222${n}`,
    title: `Headline ${n}`,
    publisher: "Reuters",
    publishedAt: "2026-11-04T08:30:00Z",
    url: `https://news.example.com/${n}`,
  };
}

function renderList(firstPage: NewsPage, loadMoreNews: LoadMoreNews = vi.fn()) {
  render(
    <InstrumentNewsList
      instrumentId={INSTRUMENT_ID}
      firstPage={firstPage}
      loadMoreNews={loadMoreNews}
    />,
  );
  return { user: userEvent.setup(), loadMoreNews };
}

describe("InstrumentNewsList", () => {
  it("says there is no news yet rather than showing an empty list", () => {
    renderList({ articles: [], nextCursor: null });

    expect(screen.getByText("No news about this security yet.")).toBeInTheDocument();
  });

  it("appends the older page below the first, and offers no more once the API has none", async () => {
    const loadMoreNews = vi.fn<LoadMoreNews>(async () => ({
      ok: true,
      page: { articles: [article(2)], nextCursor: null },
    }));
    const { user } = renderList({ articles: [article(1)], nextCursor: "cursor-2" }, loadMoreNews);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMoreNews).toHaveBeenCalledWith(INSTRUMENT_ID, "cursor-2");
    expect((await screen.findAllByRole("link")).map((link) => link.textContent)).toEqual([
      "Headline 1",
      "Headline 2",
    ]);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("keeps the articles shown and the button, and says why, when a page fails to load", async () => {
    const loadMoreNews = vi.fn<LoadMoreNews>(async () => ({
      ok: false,
      message: "Could not load older news. Try again.",
    }));
    const { user } = renderList({ articles: [article(1)], nextCursor: "cursor-2" }, loadMoreNews);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load older news. Try again.",
    );
    expect(screen.getByRole("link", { name: "Headline 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
  });
});
