// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMoreNews } from "@/features/news/actions/load-more-news";
import type { components } from "@/shared/api/api.types";
import { fakeApi } from "@/shared/api/fake-api";

vi.mock("next/headers", () => ({
  cookies: async () =>
    new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sn_access=access-1; sn_refresh=refresh-1" },
    }).cookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const INSTRUMENT_ID = "a1111111-1111-4111-8111-111111111111";
const NEWS = `GET /api/v1/instruments/${INSTRUMENT_ID}/news`;

const PAGE: components["schemas"]["Page_ArticleRead_"] = {
  items: [
    {
      id: "b2222222-2222-4222-8222-222222222222",
      title: "LVMH names a new chief of its fashion house",
      publisher: "Reuters",
      published_at: "2026-11-04T08:30:00Z",
      url: "https://news.example.com/lvmh",
    },
  ],
  next_cursor: "cursor-3",
};

describe("loadMoreNews", () => {
  it("asks for the page after the cursor and answers it as domain objects", async () => {
    const api = fakeApi({ [NEWS]: () => ({ status: 200, body: PAGE }) });

    expect(await loadMoreNews(INSTRUMENT_ID, "cursor-2")).toEqual({
      ok: true,
      page: {
        articles: [
          {
            id: "b2222222-2222-4222-8222-222222222222",
            title: "LVMH names a new chief of its fashion house",
            publisher: "Reuters",
            publishedAt: "2026-11-04T08:30:00Z",
            url: "https://news.example.com/lvmh",
          },
        ],
        nextCursor: "cursor-3",
      },
    });
    expect(api.calls(NEWS)[0]?.query.get("cursor")).toBe("cursor-2");
  });

  it("refuses a malformed id or an empty cursor without calling the API", async () => {
    const api = fakeApi({});

    expect(await loadMoreNews("not-an-id", "cursor-2")).toMatchObject({ ok: false });
    expect(await loadMoreNews(INSTRUMENT_ID, "")).toMatchObject({ ok: false });
    expect(api.requests).toHaveLength(0);
  });

  it("answers a failure with a message to retry, rather than throwing", async () => {
    fakeApi({
      [NEWS]: () => ({
        status: 500,
        body: { code: "internal_error", message: "No.", details: null },
      }),
    });

    expect(await loadMoreNews(INSTRUMENT_ID, "cursor-2")).toEqual({
      ok: false,
      message: "Could not load older news. Try again.",
    });
  });
});
