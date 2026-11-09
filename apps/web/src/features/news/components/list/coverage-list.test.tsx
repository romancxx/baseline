import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Instrument, InstrumentSchema } from "@/features/instruments";
import { CoverageList } from "@/features/news/components/list/coverage-list";
import { type FeedItem, FeedItemSchema } from "@/features/news/schemas/feed.schema";

function instrument(id: string, ticker: string): Instrument {
  return InstrumentSchema.parse({
    id,
    ticker,
    isin: null,
    name: ticker,
    type: "etf",
    macroBucket: null,
  });
}

const iwda = instrument("a1111111-1111-4111-8111-111111111111", "IWDA");
const asml = instrument("b2222222-2222-4222-8222-222222222222", "ASML");
const eimi = instrument("c3333333-3333-4333-8333-333333333333", "EIMI");

function article(id: string, instruments: readonly Instrument[]): FeedItem {
  return FeedItemSchema.parse({
    kind: "article",
    id,
    title: "Headline",
    url: "https://example.com/a",
    teaser: null,
    instruments,
    tone: null,
    provenance: {
      source: "Reuters",
      publishedAt: new Date("2026-08-24T06:12:00Z"),
      model: null,
      generatedAt: null,
    },
  });
}

describe("CoverageList", () => {
  const items = [
    article("d4444444-4444-4444-8444-444444444441", [asml]),
    article("d4444444-4444-4444-8444-444444444442", [iwda, asml]),
    article("d4444444-4444-4444-8444-444444444443", [asml]),
  ];

  it("counts articles per instrument, most recently covered first", () => {
    render(<CoverageList items={items} instruments={[iwda, asml, eimi]} />);

    const covered = within(screen.getByRole("heading", { name: "Covered" }).closest("section")!);
    const rows = covered.getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("ASML3 articles");
    expect(rows[1]).toHaveTextContent("IWDA1 article");
  });

  it("lists instruments with no articles separately rather than leaving them out", () => {
    render(<CoverageList items={items} instruments={[iwda, asml, eimi]} />);

    const noNews = within(screen.getByRole("heading", { name: "No news" }).closest("section")!);

    expect(noNews.getByText("EIMI")).toBeInTheDocument();
    expect(noNews.getByText("—")).toBeInTheDocument();
  });

  it("omits the no-news group when every instrument has coverage", () => {
    render(<CoverageList items={items} instruments={[iwda, asml]} />);

    expect(screen.queryByRole("heading", { name: "No news" })).not.toBeInTheDocument();
  });
});
