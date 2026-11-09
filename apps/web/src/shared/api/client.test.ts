// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, send } from "@/shared/api/client";
import { fakeApi } from "@/shared/api/fake-api";

const ME = "GET /api/v1/users/me";
const USER = {
  id: "0190a5b2-0000-7000-8000-000000000001",
  email: "alice@example.com",
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function readMe(accessToken: string | null = "access-1") {
  const api = createApiClient({ accessToken, requestId: "request-1" });
  return send(api.GET("/api/v1/users/me"));
}

describe("the API client", () => {
  it("resolves to the data of a successful answer", async () => {
    fakeApi({ [ME]: () => ({ status: 200, body: USER }) });

    expect(await readMe()).toMatchObject({ ok: true, data: USER });
  });

  it("turns the API's error body into an ApiError, with the request ID the API answered with", async () => {
    fakeApi({
      [ME]: () => ({
        status: 422,
        body: {
          code: "validation_error",
          message: "The request is invalid.",
          details: [{ loc: ["body", "email"], message: "Not an email.", type: "value_error" }],
        },
        headers: [["x-request-id", "answered-1"]],
      }),
    });

    expect(await readMe()).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "validation_error",
        message: "The request is invalid.",
        details: [{ loc: ["body", "email"], message: "Not an email.", type: "value_error" }],
        requestId: "answered-1",
      },
    });
  });

  it.each([
    ["an HTML page", { status: 502, text: "<html><body>Bad Gateway</body></html>" }],
    ["an empty body", { status: 502, text: "" }],
    ["JSON of another shape", { status: 500, body: { detail: "Internal Server Error" } }],
  ])(
    "turns %s into an unexpected response, keeping the status, rather than crashing",
    async (_, answer) => {
      fakeApi({ [ME]: () => answer });

      expect(await readMe()).toMatchObject({
        ok: false,
        error: { status: answer.status, code: "unexpected_response", details: null },
      });
    },
  );

  it("turns a fetch that throws into a network error with status 0, rather than rejecting", async () => {
    fakeApi({
      [ME]: () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(await readMe()).toMatchObject({
      ok: false,
      error: { status: 0, code: "network_error" },
    });
  });

  it("sends the access token as a bearer token, and the request ID", async () => {
    const api = fakeApi({ [ME]: () => ({ status: 200, body: USER }) });

    await readMe("access-1");

    const [request] = api.calls(ME);
    expect(request?.headers.get("authorization")).toBe("Bearer access-1");
    expect(request?.headers.get("x-request-id")).toBe("request-1");
  });

  it("sends no Authorization header without an access token", async () => {
    const api = fakeApi({ [ME]: () => ({ status: 200, body: USER }) });

    await readMe(null);

    expect(api.calls(ME)[0]?.headers.has("authorization")).toBe(false);
  });
});
