import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewsFeed } from "@/features/news/components/list/news-feed";
import { type FeedItem, FeedItemSchema } from "@/features/news/schemas/feed.schema";

const instrument = {
  id: "a1111111-1111-4111-8111-111111111111",
  ticker: "AAPL",
  isin: null,
  name: "Apple",
  type: "stock",
  macroBucket: "big-tech",
};

const nvidia = {
  id: "b2222222-2222-4222-8222-222222222222",
  ticker: "NVDA",
  isin: null,
  name: "NVIDIA",
  type: "stock",
  macroBucket: "semiconductors",
};

function articleItem(overrides: Record<string, unknown> = {}): FeedItem {
  return FeedItemSchema.parse({
    kind: "article",
    id: "c3333333-3333-4333-8333-333333333333",
    title: "Apple beats estimates",
    url: "https://example.com/apple",
    teaser: "Revenue came in ahead of guidance.",
    instruments: [instrument],
    tonality: "bullish",
    confidence: 0.8,
    provenance: {
      source: "MarketWatch",
      publishedAt: new Date("2026-09-26T07:56:00Z"),
      model: "claude-haiku-4-5",
      generatedAt: new Date("2026-09-27T14:58:00Z"),
    },
    ...overrides,
  });
}

describe("NewsFeed", () => {
  it("renders the headline as a noreferrer link to the source", () => {
    render(<NewsFeed items={[articleItem()]} hasInstruments />);

    const link = screen.getByRole("link", { name: "Apple beats estimates" });
    expect(link).toHaveAttribute("href", "https://example.com/apple");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("heads the card with the instrument's ticker and name", () => {
    render(<NewsFeed items={[articleItem()]} hasInstruments />);

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("labels tonality and credits the model in the badge's hover text", () => {
    render(<NewsFeed items={[articleItem()]} hasInstruments />);

    const badge = screen.getByText("Constructive");
    expect(badge).toHaveAttribute("title", expect.stringContaining("claude-haiku-4-5"));
  });

  it("attributes the article to its source with a machine-readable UTC stamp", () => {
    render(<NewsFeed items={[articleItem()]} hasInstruments />);

    const provenance = screen.getByText("MarketWatch").closest("p");
    // Month abbreviations vary by ICU version; the machine-readable stamp does not.
    expect(provenance?.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-09-26T07:56:00.000Z",
    );
    expect(provenance).toHaveTextContent("07:56 UTC");
  });

  it("says an article is unclassified rather than implying a tonality", () => {
    render(
      <NewsFeed
        items={[
          articleItem({
            tonality: null,
            confidence: null,
            provenance: {
              source: "CNBC",
              publishedAt: new Date("2026-09-26T07:56:00Z"),
              model: null,
              generatedAt: null,
            },
          }),
        ]}
        hasInstruments
      />,
    );

    expect(screen.getByText(/not yet classified/)).toBeInTheDocument();
    expect(screen.queryByText("Constructive")).not.toBeInTheDocument();
  });

  it("heads a multi-instrument card with the first instrument and counts the rest, rather than repeating the card", () => {
    render(
      <NewsFeed items={[articleItem({ instruments: [instrument, nvidia] })]} hasInstruments />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("+1")).toHaveAttribute("title", "NVDA");
  });

  it("omits the teaser paragraph when the source gave none", () => {
    render(<NewsFeed items={[articleItem({ teaser: null })]} hasInstruments />);

    expect(screen.queryByText("Revenue came in ahead of guidance.")).not.toBeInTheDocument();
  });

  it("tells a user with no instruments to add one, rather than showing a blank feed", () => {
    render(<NewsFeed items={[]} hasInstruments={false} />);

    expect(screen.getByText(/Add a position/)).toBeInTheDocument();
  });

  it("distinguishes an empty feed from an empty portfolio", () => {
    render(<NewsFeed items={[]} hasInstruments />);

    expect(screen.getByText(/Nothing published for your instruments yet/)).toBeInTheDocument();
  });
});
