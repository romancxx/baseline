import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewLayout } from "@/features/news/components/layout/review-layout";

const DATE = new Date("2026-08-24T07:00:00Z");

describe("ReviewLayout", () => {
  it("headlines the number of articles kept, even when it is zero", () => {
    render(<ReviewLayout date={DATE} items={[]} instruments={[]} filter="all" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("0articles kept");
  });

  it("marks the active filter as the current page", () => {
    render(<ReviewLayout date={DATE} items={[]} instruments={[]} filter="watchlist" />);

    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("always shows the disclaimer, including when the feed is empty", () => {
    render(<ReviewLayout date={DATE} items={[]} instruments={[]} filter="all" />);

    expect(screen.getByText(/Not a forecast, not advice/)).toBeInTheDocument();
  });
});
