// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "@/shared/api/fake-api";
import { readApi } from "@/shared/api/request";

const requestCookies = new NextRequest("http://localhost:3000/", {
  headers: { cookie: "sn_access=access-1; sn_refresh=refresh-1" },
}).cookies;

vi.mock("next/headers", () => ({
  cookies: async () => requestCookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

const ME = "GET /api/v1/users/me";

afterEach(() => {
  vi.unstubAllGlobals();
});

function loadUser() {
  return readApi("load the user", (api) => api.GET("/api/v1/users/me"));
}

describe("reading from the API while rendering", () => {
  it("calls the API with the session's access token and the request's ID", async () => {
    const api = fakeApi({
      [ME]: () => ({ status: 200, body: { id: "user-1", email: "alice@example.com" } }),
    });

    expect(await loadUser()).toMatchObject({ email: "alice@example.com" });
    const [request] = api.calls(ME);
    expect(request?.headers.get("authorization")).toBe("Bearer access-1");
    expect(request?.headers.get("x-request-id")).toBe("request-1");
  });

  it("throws on a server error, naming what could not be read", async () => {
    fakeApi({
      [ME]: () => ({
        status: 500,
        body: { code: "internal_error", message: "An unexpected error occurred.", details: null },
      }),
    });

    await expect(loadUser()).rejects.toThrow(
      "Could not load the user: An unexpected error occurred.",
    );
  });

  it("redirects to /session/expired on a 401, since rendering cannot clear the cookies", async () => {
    fakeApi({
      [ME]: () => ({
        status: 401,
        body: { code: "invalid_token", message: "The token is invalid.", details: null },
      }),
    });

    await expect(loadUser()).rejects.toMatchObject({
      digest: expect.stringContaining(";/session/expired;"),
    });
  });
});
