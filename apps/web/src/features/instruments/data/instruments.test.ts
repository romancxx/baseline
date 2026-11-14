// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstrument } from "@/features/instruments/data/instruments";
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

const MC_ID = "a1111111-1111-4111-8111-111111111111";
const GET = `GET /api/v1/instruments/${MC_ID}`;

const MC: components["schemas"]["InstrumentRead"] = {
  id: MC_ID,
  type: "stock",
  name: "LVMH Moët Hennessy Louis Vuitton",
  yahoo_symbol: "MC.PA",
  exchange_code: "PAR",
  currency: "EUR",
  isin: "FR0000121014",
  share_class_figi: null,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
};

describe("getInstrument", () => {
  it("answers the listing as a domain object", async () => {
    fakeApi({ [GET]: () => ({ status: 200, body: MC }) });

    expect(await getInstrument(MC_ID)).toEqual({
      id: MC_ID,
      type: "stock",
      name: "LVMH Moët Hennessy Louis Vuitton",
      symbol: "MC.PA",
      exchangeCode: "PAR",
      currency: "EUR",
      isin: "FR0000121014",
    });
  });

  it("answers null for a malformed id without calling the API, rather than throwing on its 422", async () => {
    const api = fakeApi({});

    expect(await getInstrument("not-an-id")).toBeNull();
    expect(api.requests).toHaveLength(0);
  });

  it("answers null for an unknown listing", async () => {
    fakeApi({});

    expect(await getInstrument(MC_ID)).toBeNull();
  });
});
