import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricesAsOfStamp } from "@/features/portfolio/components/display/prices-as-of-stamp";

describe("PricesAsOfStamp", () => {
  it("names the day of the closes the figures use, without the year", () => {
    render(<PricesAsOfStamp date="2026-11-05" />);

    expect(screen.getByText("Prices · close of 5 Nov")).toBeInTheDocument();
  });

  it("renders nothing rather than a date that means nothing when no holding is priced", () => {
    const { container } = render(<PricesAsOfStamp date={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
