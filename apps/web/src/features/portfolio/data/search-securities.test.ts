// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchSecurities } from "@/features/portfolio/data/search-securities";
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

const SEARCH = "GET /api/v1/instruments/search";
const OVERVIEW = "GET /api/v1/portfolio/overview";
const STAMP = "2026-11-01T09:00:00Z";

function instrument(id: string, symbol: string): components["schemas"]["InstrumentRead"] {
  return {
    id,
    type: "stock",
    name: "LVMH Moët Hennessy Louis Vuitton",
    yahoo_symbol: symbol,
    exchange_code: "PAR",
    currency: "EUR",
    isin: "FR0000121014",
    share_class_figi: null,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

const MC = instrument("a1111111-1111-4111-8111-111111111111", "MC.PA");
const MOH = instrument("b2222222-2222-4222-8222-222222222222", "MOH.DE");
const LVMHF = instrument("c3333333-3333-4333-8333-333333333333", "LVMHF");

function position(
  id: string,
  held: components["schemas"]["InstrumentRead"],
  quantity: string | null,
): components["schemas"]["PositionOverview"] {
  return {
    position: {
      id,
      instrument: held,
      quantity,
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
  };
}

const OVERVIEW_ANSWER: components["schemas"]["PortfolioOverviewResponse"] = {
  positions: [
    position("d4444444-4444-4444-8444-444444444441", MC, "4"),
    position("d4444444-4444-4444-8444-444444444442", LVMHF, null),
  ],
  totals: {
    base_currency: "EUR",
    value_base: null,
    unrealised_gain_base: null,
    unrealised_gain_base_pct: null,
    positions: 2,
    valued_positions: 0,
    prices_as_of: null,
    unvalued: [],
  },
};

const SEARCH_ANSWER: components["schemas"]["InstrumentSearchResponse"] = {
  items: [
    { ...MC, source: "local" },
    { ...MOH, source: "local" },
    { ...LVMHF, source: "local" },
    {
      source: "yahoo",
      yahoo_symbol: "LVMUY",
      name: "LVMH ADR",
      exchange_code: "PNK",
      type: "stock",
    },
  ],
  yahoo_unavailable: false,
};

describe("searching securities", () => {
  it("marks the catalogue results the user holds, with the quantity when there is one", async () => {
    fakeApi({
      [SEARCH]: () => ({ status: 200, body: SEARCH_ANSWER }),
      [OVERVIEW]: () => ({ status: 200, body: OVERVIEW_ANSWER }),
    });

    const { catalogue } = await searchSecurities("lvmh");

    expect(
      catalogue.map(({ symbol, held, heldQuantity }) => ({ symbol, held, heldQuantity })),
    ).toEqual([
      { symbol: "MC.PA", held: true, heldQuantity: "4" },
      { symbol: "MOH.DE", held: false, heldQuantity: null },
      { symbol: "LVMHF", held: true, heldQuantity: null },
    ]);
  });

  it("lists the provider's candidates apart, with no holding attached", async () => {
    fakeApi({
      [SEARCH]: () => ({ status: 200, body: { ...SEARCH_ANSWER, yahoo_unavailable: true } }),
      [OVERVIEW]: () => ({ status: 200, body: OVERVIEW_ANSWER }),
    });

    const { provider, providerUnavailable } = await searchSecurities("lvmh");

    expect(provider).toEqual([
      {
        source: "provider",
        name: "LVMH ADR",
        symbol: "LVMUY",
        exchangeCode: "PNK",
        type: "stock",
      },
    ]);
    expect(providerUnavailable).toBe(true);
  });

  it("sends the query trimmed", async () => {
    const api = fakeApi({
      [SEARCH]: () => ({ status: 200, body: SEARCH_ANSWER }),
      [OVERVIEW]: () => ({ status: 200, body: OVERVIEW_ANSWER }),
    });

    await searchSecurities("  lvmh ");

    const [request] = api.calls(SEARCH);
    expect(request?.query.get("q")).toBe("lvmh");
  });

  it("answers nothing under two characters, rather than asking the API", async () => {
    const api = fakeApi({});

    expect(await searchSecurities(" l ")).toEqual({
      catalogue: [],
      provider: [],
      providerUnavailable: false,
    });
    expect(api.requests).toHaveLength(0);
  });
});
