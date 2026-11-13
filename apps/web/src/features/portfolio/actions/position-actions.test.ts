// @vitest-environment node
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editPosition, removePosition } from "@/features/portfolio/actions/position-actions";
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
const POSITION = `/api/v1/portfolio/positions/${POSITION_ID}`;
const PATCH = `PATCH ${POSITION}`;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function edit(quantity: string, averagePrice: string) {
  return editPosition(IDLE, form({ positionId: POSITION_ID, quantity, averagePrice }));
}

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

  it("refreshes Holdings once saved", async () => {
    fakeApi({ [PATCH]: () => ({ status: 200, body: {} }) });

    await edit("4", "");

    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
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
    return removePosition(IDLE, form({ positionId: POSITION_ID }));
  }

  it("deletes the holding and refreshes Holdings", async () => {
    const api = fakeApi({ [DELETE]: () => ({ status: 204 }) });

    expect(await remove()).toEqual({ status: "success" });
    expect(api.calls(DELETE)).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
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
