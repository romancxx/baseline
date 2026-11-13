// @vitest-environment node
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addPosition,
  editPosition,
  removePosition,
} from "@/features/portfolio/actions/position-actions";
import { fakeApi } from "@/shared/api/fake-api";
import { IDLE } from "@/shared/form-state";

vi.mock("next/headers", () => ({
  cookies: async () =>
    new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sn_access=access-1; sn_refresh=refresh-1" },
    }).cookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(revalidatePath).mockClear();
});

const POSITION_ID = "a1111111-1111-4111-8111-111111111111";
const INSTRUMENT_ID = "e5555555-5555-4555-8555-555555555555";
const POSITION = `/api/v1/portfolio/positions/${POSITION_ID}`;
const PATCH = `PATCH ${POSITION}`;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function edit(quantity: string, averagePrice: string) {
  return editPosition(
    IDLE,
    form({ positionId: POSITION_ID, instrumentId: INSTRUMENT_ID, quantity, averagePrice }),
  );
}

describe("adding a holding", () => {
  const POST = "POST /api/v1/portfolio/positions";

  function add(quantity: string, averagePrice: string) {
    return addPosition(IDLE, form({ instrumentId: INSTRUMENT_ID, quantity, averagePrice }));
  }

  it("adds the listing with its position as decimal strings, and refreshes Holdings and its page", async () => {
    const api = fakeApi({ [POST]: () => ({ status: 201, body: {} }) });

    expect(await add("12", "58.75")).toEqual({ status: "success" });
    expect(JSON.parse(api.calls(POST)[0]?.body ?? "")).toEqual({
      instrument_id: INSTRUMENT_ID,
      quantity: "12",
      average_price: "58.75",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
    expect(revalidatePath).toHaveBeenCalledWith(`/instruments/${INSTRUMENT_ID}`);
  });

  it("adds the listing without a position when both fields are empty", async () => {
    const api = fakeApi({ [POST]: () => ({ status: 201, body: {} }) });

    await add("", "");

    expect(JSON.parse(api.calls(POST)[0]?.body ?? "")).toEqual({
      instrument_id: INSTRUMENT_ID,
      quantity: null,
      average_price: null,
    });
  });

  it.each([
    ["conflict", "This security is already in your holdings."],
    ["not_found", "This security no longer exists."],
    ["internal_error", "Could not add the security. Try again."],
  ])("explains a %s answer", async (code, message) => {
    fakeApi({ [POST]: () => ({ status: 409, body: { code, message: "No.", details: null } }) });

    expect(await add("12", "")).toEqual({ status: "error", message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("editing a holding", () => {
  it("sends the quantity and average price as decimal strings, never as numbers", async () => {
    const api = fakeApi({ [PATCH]: () => ({ status: 200, body: {} }) });

    expect(await edit("12.5", "180.42")).toEqual({ status: "success" });
    expect(JSON.parse(api.calls(PATCH)[0]?.body ?? "")).toEqual({
      quantity: "12.5",
      average_price: "180.42",
    });
  });

  it("sends both as null when both are cleared, dropping the position but keeping the security", async () => {
    const api = fakeApi({ [PATCH]: () => ({ status: 200, body: {} }) });

    await edit(" ", "");

    expect(JSON.parse(api.calls(PATCH)[0]?.body ?? "")).toEqual({
      quantity: null,
      average_price: null,
    });
  });

  it("refreshes Holdings and the listing's page once saved", async () => {
    fakeApi({ [PATCH]: () => ({ status: 200, body: {} }) });

    await edit("4", "");

    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
    expect(revalidatePath).toHaveBeenCalledWith(`/instruments/${INSTRUMENT_ID}`);
  });

  it.each([
    ["0", "1", "Quantity must be a positive number."],
    ["-3", "1", "Quantity must be a positive number."],
    ["1,5", "1", "Quantity must be a positive number."],
    ["4", "abc", "Average price must be a positive number."],
    ["4", "0.000000001", "Average price must be a positive number."],
  ])(
    "rejects a quantity of %s with an average price of %s without calling the API",
    async (quantity, averagePrice, message) => {
      const api = fakeApi({ [PATCH]: () => ({ status: 200, body: {} }) });

      expect(await edit(quantity, averagePrice)).toEqual({ status: "error", message });
      expect(api.requests).toHaveLength(0);
    },
  );

  it("says the holding was already removed when the API no longer has it", async () => {
    fakeApi({
      [PATCH]: () => ({
        status: 404,
        body: { code: "not_found", message: "Position not found", details: null },
      }),
    });

    expect(await edit("4", "")).toEqual({
      status: "error",
      message: "This holding was already removed.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("gives a generic message on any other failure, rather than the API's", async () => {
    fakeApi({
      [PATCH]: () => ({
        status: 500,
        body: { code: "internal_error", message: "An unexpected error occurred.", details: null },
      }),
    });

    expect(await edit("4", "")).toEqual({
      status: "error",
      message: "Could not save your changes. Try again.",
    });
  });
});

describe("removing a holding", () => {
  const DELETE = `DELETE ${POSITION}`;

  function remove() {
    return removePosition(IDLE, form({ positionId: POSITION_ID, instrumentId: INSTRUMENT_ID }));
  }

  it("deletes the holding and refreshes Holdings and the listing's page", async () => {
    const api = fakeApi({ [DELETE]: () => ({ status: 204 }) });

    expect(await remove()).toEqual({ status: "success" });
    expect(api.calls(DELETE)).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
    expect(revalidatePath).toHaveBeenCalledWith(`/instruments/${INSTRUMENT_ID}`);
  });

  it("says the holding was already removed when the API no longer has it", async () => {
    fakeApi({
      [DELETE]: () => ({
        status: 404,
        body: { code: "not_found", message: "Position not found", details: null },
      }),
    });

    expect(await remove()).toEqual({
      status: "error",
      message: "This holding was already removed.",
    });
  });

  it("gives a generic message on any other failure, rather than the API's", async () => {
    fakeApi({ [DELETE]: () => ({ status: 502, text: "Bad Gateway" }) });

    expect(await remove()).toEqual({
      status: "error",
      message: "Could not remove the holding. Try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
