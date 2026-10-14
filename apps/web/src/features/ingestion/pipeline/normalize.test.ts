import { describe, expect, it } from "vitest";
import {
  buildEmbeddingInput,
  cleanText,
  contentHash,
  normalizeArticle,
  stripHtml,
} from "@/features/ingestion/pipeline/normalize";
import type { RawArticle } from "@/features/ingestion/schemas/ingestion.schema";

const article: RawArticle = {
  url: "https://example.com/a",
  source: "Example",
  title: "  Fed   holds rates <em>steady</em> ",
  publishedAt: new Date("2026-09-11T10:00:00Z"),
  rawContent: "<p>Markets rose.</p>",
  origin: { kind: "finnhub", ticker: "SPY" },
};

describe("stripHtml", () => {
  it("drops tags and decodes entities", () => {
    expect(cleanText("<p>Apple &amp; Co &#39;beat&#39; estimates</p>")).toBe(
      "Apple & Co 'beat' estimates",
    );
  });

  it("removes script and style bodies entirely", () => {
    expect(cleanText("<style>p{}</style>Hi<script>evil()</script>")).toBe("Hi");
  });

  it("leaves plain text alone", () => {
    expect(stripHtml("no markup here")).toBe("no markup here");
  });
});

describe("contentHash", () => {
  it("ignores casing, punctuation and whitespace", () => {
    expect(contentHash("Fed holds rates steady!", "Markets rose.")).toBe(
      contentHash("FED  HOLDS   RATES STEADY", "markets rose"),
    );
  });

  it("does not ignore the words", () => {
    expect(contentHash("Fed holds rates", null)).not.toBe(contentHash("Fed cuts rates", null));
  });

  it("distinguishes a missing body from an empty one only by content", () => {
    expect(contentHash("Title", null)).toBe(contentHash("Title", ""));
  });

  it("is 64 hex characters", () => {
    expect(contentHash("Title", "Body")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildEmbeddingInput", () => {
  it("joins title and body", () => {
    expect(buildEmbeddingInput("Title", "<p>Body</p>")).toBe("Title\n\nBody");
  });

  it("caps the length", () => {
    expect(buildEmbeddingInput("T", "x".repeat(5000)).length).toBeLessThanOrEqual(2000);
  });
});

describe("normalizeArticle", () => {
  it("cleans the title and body, and carries the origin through", () => {
    const normalized = normalizeArticle(article);

    expect(normalized.title).toBe("Fed holds rates steady");
    expect(normalized.rawContent).toBe("Markets rose.");
    expect(normalized.origin).toEqual({ kind: "finnhub", ticker: "SPY" });
    expect(normalized.contentHash).toHaveLength(64);
  });

  it("is stable across calls", () => {
    expect(normalizeArticle(article).contentHash).toBe(normalizeArticle(article).contentHash);
  });
});
