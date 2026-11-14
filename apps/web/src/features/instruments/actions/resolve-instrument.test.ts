// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInstrument } from "@/features/instruments/actions/resolve-instrument";
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

const RESOLVE = "POST /api/v1/instruments/resolve";
const INSTRUMENT_ID = "a1111111-1111-4111-8111-111111111111";

describe("resolveInstrument", () => {
  it("stores the candidate by its trimmed symbol and gives the listing's id", async () => {
    const api = fakeApi({ [RESOLVE]: () => ({ status: 200, body: { id: INSTRUMENT_ID } }) });

    expect(await resolveInstrument(" LVMUY ")).toEqual({ ok: true, instrumentId: INSTRUMENT_ID });
    expect(JSON.parse(api.calls(RESOLVE)[0]?.body ?? "")).toEqual({ yahoo_symbol: "LVMUY" });
  });

  it("refuses an empty symbol without calling the API", async () => {
    const api = fakeApi({});

    expect(await resolveInstrument("  ")).toEqual({
      ok: false,
      message: "Pick a security to open.",
    });
    expect(api.requests).toHaveLength(0);
  });

  it.each([
    ["not_found", 404, "The market data provider no longer has this security."],
    [
      "provider_unavailable",
      503,
      "The market data provider can't be reached. Try again in a minute.",
    ],
    ["internal_error", 500, "Could not open this security. Try again."],
  ])("explains a %s answer", async (code, status, message) => {
    fakeApi({ [RESOLVE]: () => ({ status, body: { code, message: "No.", details: null } }) });

    expect(await resolveInstrument("LVMUY")).toEqual({ ok: false, message });
  });
});
