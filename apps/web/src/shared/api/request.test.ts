// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "@/shared/api/fake-api";
import { findApi, readApi, writeApi } from "@/shared/api/request";

function cookiesOf(cookie: string) {
  return new NextRequest("http://localhost:3000/", { headers: { cookie } }).cookies;
}

const SIGNED_IN = "sn_access=access-1; sn_refresh=refresh-1";
/** What a page sees when `proxy.ts` could not renew the access token because the API was down. */
const RENEWAL_UNAVAILABLE = "sn_refresh=refresh-1";

let requestCookies = cookiesOf(SIGNED_IN);

vi.mock("next/headers", () => ({
  cookies: async () => requestCookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

const ME = "GET /api/v1/users/me";
const UNAUTHORIZED_ANSWER = {
  status: 401,
  body: { code: "unauthorized", message: "Not authenticated", details: null },
};

afterEach(() => {
  vi.unstubAllGlobals();
  requestCookies = cookiesOf(SIGNED_IN);
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

  it("throws on a 401 to a call made without an access token, rather than ending a session the API never refused", async () => {
    requestCookies = cookiesOf(RENEWAL_UNAVAILABLE);
    fakeApi({ [ME]: () => UNAUTHORIZED_ANSWER });

    await expect(loadUser()).rejects.toThrow("Could not load the user: Not authenticated");
    expect(requestCookies.has("sn_refresh")).toBe(true);
  });
});

describe("reading something that may not exist", () => {
  const INSTRUMENT_ID = "a1111111-1111-4111-8111-111111111111";
  const INSTRUMENT = `GET /api/v1/instruments/${INSTRUMENT_ID}`;

  function findInstrument() {
    return findApi("load the instrument", (api) =>
      api.GET("/api/v1/instruments/{instrument_id}", {
        params: { path: { instrument_id: INSTRUMENT_ID } },
      }),
    );
  }

  it("returns null when the API answers 404 not_found, rather than throwing", async () => {
    fakeApi({
      [INSTRUMENT]: () => ({
        status: 404,
        body: { code: "not_found", message: "Instrument not found", details: null },
      }),
    });

    expect(await findInstrument()).toBeNull();
  });

  it("throws on a 404 with another code, rather than reading it as missing", async () => {
    fakeApi({
      [INSTRUMENT]: () => ({
        status: 404,
        body: { code: "no_portfolio", message: "No portfolio", details: null },
      }),
    });

    await expect(findInstrument()).rejects.toThrow("Could not load the instrument: No portfolio");
  });

  it("throws on a server error, naming what could not be read", async () => {
    fakeApi({
      [INSTRUMENT]: () => ({
        status: 500,
        body: { code: "internal_error", message: "An unexpected error occurred.", details: null },
      }),
    });

    await expect(findInstrument()).rejects.toThrow(
      "Could not load the instrument: An unexpected error occurred.",
    );
  });

  it("redirects to /session/expired on a 401, like any read while rendering", async () => {
    fakeApi({ [INSTRUMENT]: () => UNAUTHORIZED_ANSWER });

    await expect(findInstrument()).rejects.toMatchObject({
      digest: expect.stringContaining(";/session/expired;"),
    });
  });
});

describe("calling the API from a server action", () => {
  const REGISTER = "POST /api/v1/auth/register";

  function register() {
    return writeApi((api) =>
      api.POST("/api/v1/auth/register", {
        body: { email: "alice@example.com", password: "correct-horse-battery" },
      }),
    );
  }

  it("clears the session and redirects to /sign-in when the API refuses the access token", async () => {
    fakeApi({ [REGISTER]: () => UNAUTHORIZED_ANSWER });

    await expect(register()).rejects.toMatchObject({
      digest: expect.stringContaining(";/sign-in;"),
    });
    expect(requestCookies.has("sn_refresh")).toBe(false);
  });

  it("returns a 401 to a call made without an access token, keeping the session", async () => {
    requestCookies = cookiesOf(RENEWAL_UNAVAILABLE);
    fakeApi({ [REGISTER]: () => UNAUTHORIZED_ANSWER });

    expect(await register()).toMatchObject({ ok: false, error: { status: 401 } });
    expect(requestCookies.has("sn_refresh")).toBe(true);
  });
});
