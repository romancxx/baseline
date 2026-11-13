import { describe, expect, it } from "vitest";
import { parsePriceRange, rangeDates } from "@/features/instruments/utils/price-range";

const TODAY = new Date("2026-11-13T15:30:00Z");

describe("rangeDates", () => {
  it.each([
    ["1M", "2026-10-13"],
    ["6M", "2026-05-13"],
    ["1Y", "2025-11-13"],
    ["5Y", "2021-11-13"],
  ] as const)("starts %s back from today, and ends today", (range, from) => {
    expect(rangeDates(range, TODAY)).toEqual({ from, to: "2026-11-13" });
  });

  it("stops at the end of a shorter month rather than spilling into the next", () => {
    expect(rangeDates("1M", new Date("2026-03-31T09:00:00Z"))).toEqual({
      from: "2026-02-28",
      to: "2026-03-31",
    });
  });

  it("goes from a leap day to the 28th of a common year", () => {
    expect(rangeDates("1Y", new Date("2028-02-29T09:00:00Z")).from).toBe("2027-02-28");
  });
});

describe("parsePriceRange", () => {
  it("takes a known range from the address", () => {
    expect(parsePriceRange("6M")).toBe("6M");
  });

  it.each([undefined, "Max", "1y", ["1M", "5Y"]])("falls back to 1Y for %s", (value) => {
    expect(parsePriceRange(value)).toBe("1Y");
  });
});
