import { describe, expect, it } from "vitest";
import { findHolding, holdingStatus } from "@/features/portfolio/utils/holdings";
import type { Holding, PortfolioOverview } from "@/types/portfolio";

const MC_ID = "a1111111-1111-4111-8111-111111111111";

const LVMH: Holding = {
  id: "b2222222-2222-4222-8222-222222222222",
  instrument: {
    id: MC_ID,
    type: "stock",
    name: "LVMH",
    symbol: "MC.PA",
    exchangeCode: "PAR",
    currency: "EUR",
    isin: null,
  },
  quantity: "4",
  averagePrice: "612.3",
  latestClose: "586.1",
  latestCloseDate: "2026-11-05",
  value: "2344.4",
  valueBase: "2344.4",
  unrealisedGain: "-104.8",
  unrealisedGainPct: "-4.28",
  weight: "100",
  unvaluedReason: null,
};

const OVERVIEW: PortfolioOverview = {
  holdings: [LVMH],
  totals: {
    baseCurrency: "EUR",
    value: "2344.4",
    unrealisedGain: "-104.8",
    unrealisedGainPct: "-4.28",
    pricesAsOf: "2026-11-05",
    valuedCount: 1,
  },
};

describe("findHolding", () => {
  it("finds the holding of a listing in the portfolio", () => {
    expect(findHolding(OVERVIEW, MC_ID)).toBe(LVMH);
  });

  it("finds nothing for a listing not held, rather than another listing of the security", () => {
    expect(findHolding(OVERVIEW, "c3333333-3333-4333-8333-333333333333")).toBeNull();
  });
});

describe("holdingStatus", () => {
  it.each([
    ["not held", "not-held", null],
    ["valued", "held", LVMH],
    ["without a price yet", "just-added", { ...LVMH, unvaluedReason: "no_price" }],
    [
      "without a quantity",
      "no-position",
      { ...LVMH, quantity: null, unvaluedReason: "no_quantity" },
    ],
    ["without an exchange rate", "held", { ...LVMH, unvaluedReason: "no_rate" }],
  ] as const)("reads a listing %s as %s", (_, status, holding) => {
    expect(holdingStatus(holding)).toBe(status);
  });
});
