import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFeed } from "@/features/ingestion/adapters/rss";
import type { Feed } from "@/features/ingestion/schemas/ingestion.schema";

const feed: Feed = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "https://example.com/rss",
  source: "Example",
  macroBucket: "broad-market-etf",
};

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Fed holds rates steady</title>
    <link>https://example.com/fed</link>
    <pubDate>Thu, 11 Sep 2026 10:00:00 GMT</pubDate>
    <description>&lt;p&gt;Markets rose.&lt;/p&gt;</description>
  </item>
  <item>
    <title>No date here</title>
    <link>https://example.com/undated</link>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>ECB statement</title>
    <link rel="alternate" href="https://example.com/ecb"/>
    <updated>2026-09-11T09:00:00Z</updated>
    <summary>Rates unchanged.</summary>
  </entry>
</feed>`;

function respondWith(body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(body, { status: 200 }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFeed", () => {
  it("parses RSS items and tags them with the feed's origin", async () => {
    respondWith(RSS);

    const [first] = await fetchFeed(feed);

    expect(first?.title).toBe("Fed holds rates steady");
    expect(first?.url).toBe("https://example.com/fed");
    expect(first?.rawContent).toBe("<p>Markets rose.</p>");
    expect(first?.publishedAt.toISOString()).toBe("2026-09-11T10:00:00.000Z");
    expect(first?.origin).toEqual({
      kind: "rss",
      feedId: feed.id,
      macroBucket: "broad-market-etf",
    });
  });

  it("skips entries with no usable date", async () => {
    respondWith(RSS);

    const articles = await fetchFeed(feed);

    expect(articles).toHaveLength(1);
  });

  it("reads Atom entries, whose link is an attribute", async () => {
    respondWith(ATOM);

    const [first] = await fetchFeed(feed);

    expect(first?.url).toBe("https://example.com/ecb");
    expect(first?.rawContent).toBe("Rates unchanged.");
  });

  it("returns nothing rather than throwing when the feed errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 503 }))),
    );

    await expect(fetchFeed(feed)).resolves.toEqual([]);
  });
});
