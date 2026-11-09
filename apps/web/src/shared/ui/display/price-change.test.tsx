import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceChange } from "@/shared/ui/display/price-change";

const MINUS = "−";

describe("PriceChange", () => {
  it.each([
    ["a rise", "0.65", "+0.65%"],
    ["a fall", "-1.2", `${MINUS}1.2%`],
    ["no change", "0", "0.0%"],
    ["a missing change", null, "—"],
  ])("shows %s in percent with its sign first: %s", (_, value, expected) => {
    const { container } = render(<PriceChange value={value} unit="percent" />);

    expect(container).toHaveTextContent(expected, { normalizeWhitespace: false });
  });

  it.each([
    ["a gain", "217.5", "+€217.50"],
    ["a loss", "-104.8", `${MINUS}€104.80`],
    ["no change", "0", "€0.00"],
    ["a missing change", null, "—"],
  ])("shows %s in money with its sign first: %s", (_, value, expected) => {
    const { container } = render(<PriceChange value={value} currency="EUR" />);

    expect(container).toHaveTextContent(expected, { normalizeWhitespace: false });
  });

  it("writes a fall with a true minus sign, never a hyphen", () => {
    const { container } = render(<PriceChange value="-1.2" unit="percent" />);

    expect(container.textContent).not.toContain("-");
  });
});
