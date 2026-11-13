import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceRangeLinks } from "@/features/instruments/components/navigation/price-range-links";

const ID = "a1111111-1111-4111-8111-111111111111";

describe("PriceRangeLinks", () => {
  it("links each range to the page with it in the address, so reloading or sharing keeps it", () => {
    render(<PriceRangeLinks instrumentId={ID} active="1Y" />);

    const links = within(screen.getByRole("navigation", { name: "Price range" })).getAllByRole(
      "link",
    );
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["1M", `/instruments/${ID}?range=1M`],
      ["6M", `/instruments/${ID}?range=6M`],
      ["1Y", `/instruments/${ID}?range=1Y`],
      ["5Y", `/instruments/${ID}?range=5Y`],
    ]);
  });

  it("marks only the range shown as current", () => {
    render(<PriceRangeLinks instrumentId={ID} active="6M" />);

    expect(screen.getByRole("link", { name: "6M" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "1Y" })).not.toHaveAttribute("aria-current");
  });
});
