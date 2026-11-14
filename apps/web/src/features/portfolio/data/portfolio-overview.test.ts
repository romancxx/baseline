// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPortfolioOverview } from "@/features/portfolio/data/portfolio-overview";
import type { components } from "@/shared/api/api.types";
import { fakeApi } from "@/shared/api/fake-api";

vi.mock("next/headers", () => ({
  cookies: async () =>
    new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sn_access=access-1; sn_refresh=refresh-1" },
    }).cookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const OVERVIEW = "GET /api/v1/portfolio/overview";
const STAMP = "2026-11-01T09:00:00Z";
const VALUED_ID = "d4444444-4444-4444-8444-444444444441";
const UNPRICED_ID = "d4444444-4444-4444-8444-444444444442";

function instrument(id: string, symbol: string): components["schemas"]["InstrumentRead"] {
  return {
    id,
    type: "stock",
    name: symbol,
    yahoo_symbol: symbol,
    exchange_code: "PAR",
    currency: "EUR",
    isin: null,
    share_class_figi: null,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

const ANSWER: components["schemas"]["PortfolioOverviewResponse"] = {
  positions: [
    {
      position: {
        id: VALUED_ID,
        instrument: instrument("a1111111-1111-4111-8111-111111111111", "MC.PA"),
        quantity: "4",
        average_price: "612.3",
        created_at: STAMP,
        updated_at: STAMP,
      },
      latest_close: "586.1",
      latest_close_date: "2026-11-05",
      value: "2344.4",
      value_base: "2344.4",
      unrealised_gain: "-104.8",
      unrealised_gain_pct: "-4.28",
      weight: "100",
    },
    {
      position: {
        id: UNPRICED_ID,
        instrument: instrument("b2222222-2222-4222-8222-222222222222", "OR.PA"),
        quantity: "2",
        average_price: null,
        created_at: STAMP,
        updated_at: STAMP,
      },
      latest_close: null,
      latest_close_date: null,
      value: null,
      value_base: null,
      unrealised_gain: null,
      unrealised_gain_pct: null,
      weight: null,
    },
  ],
  totals: {
    base_currency: "EUR",
    value_base: "2344.4",
    unrealised_gain_base: "-104.8",
    unrealised_gain_base_pct: "-4.28",
    positions: 2,
    valued_positions: 1,
    prices_as_of: "2026-11-05",
    unvalued: [{ position_id: UNPRICED_ID, reason: "no_price" }],
  },
};

describe("getPortfolioOverview", () => {
  it("keeps every figure as the API's decimal string, under camelCase names", async () => {
    fakeApi({ [OVERVIEW]: () => ({ status: 200, body: ANSWER }) });

    const { holdings, totals } = await getPortfolioOverview();

    expect(holdings[0]).toMatchObject({
      id: VALUED_ID,
      quantity: "4",
      averagePrice: "612.3",
      latestClose: "586.1",
      latestCloseDate: "2026-11-05",
      value: "2344.4",
      valueBase: "2344.4",
      unrealisedGain: "-104.8",
      unrealisedGainPct: "-4.28",
      weight: "100",
    });
    expect(totals).toEqual({
      baseCurrency: "EUR",
      value: "2344.4",
      unrealisedGain: "-104.8",
      unrealisedGainPct: "-4.28",
      valuedCount: 1,
      pricesAsOf: "2026-11-05",
    });
  });

  it("gives each holding the reason the totals left it out, by position id, rather than by order", async () => {
    fakeApi({ [OVERVIEW]: () => ({ status: 200, body: ANSWER }) });

    const { holdings } = await getPortfolioOverview();

    expect(holdings.map(({ id, unvaluedReason }) => [id, unvaluedReason])).toEqual([
      [VALUED_ID, null],
      [UNPRICED_ID, "no_price"],
    ]);
  });
});
