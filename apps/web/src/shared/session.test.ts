// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, fakeApi } from "@/shared/api/fake-api";
import {
  clearSession,
  createSession,
  readSession,
  refreshSession,
  writeSession,
} from "@/shared/session";
import type { FakeAnswer } from "@/types/fake-api";

const TOKENS = { accessToken: "access-1", expiresIn: 900, refreshToken: "refresh-1" };
const THIRTY_DAYS_IN_SECONDS = 2_592_000;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("writing a session", () => {
  it("sets the access and refresh cookies, HttpOnly on the whole site, the access one expiring a minute early", () => {
    const { cookies } = NextResponse.next();

    writeSession(cookies, TOKENS);

    expect(cookies.get("sn_access")).toMatchObject({
      value: "access-1",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 840,
    });
    expect(cookies.get("sn_refresh")).toMatchObject({
      value: "refresh-1",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: THIRTY_DAYS_IN_SECONDS,
    });
  });

  it.each([
    ["https", "https://stocknews.example", true],
    ["http", "http://localhost:3000", false],
  ])(
    "marks the cookies Secure exactly when the app is served over %s",
    async (_, appUrl, secure) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl);
      vi.resetModules();
      const session = await import("@/shared/session");
      const { cookies } = NextResponse.next();

      session.writeSession(cookies, TOKENS);

      expect(cookies.get("sn_access")?.secure).toBe(secure);
      expect(cookies.get("sn_refresh")?.secure).toBe(secure);
    },
  );
});

function requestWithCookies(cookie: string) {
  return new NextRequest("http://localhost:3000/", { headers: { cookie } }).cookies;
}

describe("reading a session", () => {
  it("is signed out without a refresh cookie, even with an access cookie", () => {
    expect(readSession(requestWithCookies("")).status).toBe("signed-out");
    expect(readSession(requestWithCookies("sn_access=access-1")).status).toBe("signed-out");
  });

  it("is signed in with both cookies, and carries both tokens", () => {
    const session = readSession(requestWithCookies("sn_access=access-1; sn_refresh=refresh-1"));

    expect(session).toEqual({
      status: "signed-in",
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("needs a refresh with a refresh cookie and no access cookie", () => {
    const session = readSession(requestWithCookies("sn_refresh=refresh-1"));

    expect(session).toEqual({ status: "needs-refresh", refreshToken: "refresh-1" });
  });
});

describe("clearing a session", () => {
  it("expires both cookies in the browser", () => {
    const { cookies } = NextResponse.next();
    writeSession(cookies, TOKENS);

    clearSession(cookies);

    for (const name of ["sn_access", "sn_refresh"]) {
      expect(cookies.get(name)).toMatchObject({ value: "", path: "/", expires: new Date(0) });
    }
  });

  it("removes both cookies from the request, so the rest of it is signed out", () => {
    const cookies = requestWithCookies("sn_access=access-1; sn_refresh=refresh-1");

    clearSession(cookies);

    expect(readSession(cookies).status).toBe("signed-out");
    expect(cookies.has("sn_access")).toBe(false);
  });
});

const LOGIN = "POST /api/v1/auth/login";
const REFRESH = "POST /api/v1/auth/refresh";

/** The API's answer to a login or a refresh, with its refresh cookie. */
function tokenAnswer(accessToken: string, refreshToken: string | null): FakeAnswer {
  return {
    status: 200,
    body: { access_token: accessToken, token_type: "bearer", expires_in: 900 },
    headers:
      refreshToken === null
        ? []
        : [
            [
              "set-cookie",
              `refresh_token=${refreshToken}; HttpOnly; Max-Age=2592000; Path=/api/v1/auth; SameSite=strict; Secure`,
            ],
          ],
  };
}

describe("creating a session", () => {
  it("signs in with the form-encoded credentials, and reads the refresh token from the API's cookie", async () => {
    const api = fakeApi({ [LOGIN]: () => tokenAnswer("access-1", "refresh-1") });

    const result = await createSession(
      { email: "alice@example.com", password: "correct-horse-battery" },
      "request-1",
    );

    expect(result).toEqual({ ok: true, tokens: TOKENS });
    const [login] = api.calls(LOGIN);
    expect(login?.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(login?.body);
    expect(form.get("username")).toBe("alice@example.com");
    expect(form.get("password")).toBe("correct-horse-battery");
    expect(login?.headers.get("x-request-id")).toBe("request-1");
  });

  it("is an unexpected response when the API sets no refresh cookie, rather than a session without one", async () => {
    fakeApi({ [LOGIN]: () => tokenAnswer("access-1", null) });

    const result = await createSession(
      { email: "alice@example.com", password: "correct-horse-battery" },
      "request-1",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { status: 200, code: "unexpected_response" },
    });
  });

  it("returns the API's error when it refuses the credentials", async () => {
    fakeApi({
      [LOGIN]: () => ({
        status: 401,
        body: {
          code: "invalid_credentials",
          message: "Incorrect email or password.",
          details: null,
        },
      }),
    });

    const result = await createSession(
      { email: "alice@example.com", password: "wrong-password-123" },
      "request-1",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { status: 401, code: "invalid_credentials" },
    });
  });
});

const RENEWED = { accessToken: "access-2", expiresIn: 900, refreshToken: "refresh-2" };

describe("refreshing a session", () => {
  it("makes one API call for concurrent refreshes of the same token, and gives each the same tokens", async () => {
    const answer = deferred();
    const api = fakeApi({
      [REFRESH]: async () => {
        await answer.promise;
        return tokenAnswer("access-2", "refresh-2");
      },
    });

    const first = refreshSession("refresh-concurrent", "request-1");
    const second = refreshSession("refresh-concurrent", "request-2");
    answer.resolve();

    expect(await first).toEqual({ status: "renewed", tokens: RENEWED });
    expect(await second).toEqual({ status: "renewed", tokens: RENEWED });
    const calls = api.calls(REFRESH);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get("cookie")).toBe("refresh_token=refresh-concurrent");
    expect(calls[0]?.headers.get("x-request-id")).toBe("request-1");
  });

  it("gives a request still carrying the old token the same new tokens for 30 seconds, without calling the API", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const api = fakeApi({ [REFRESH]: () => tokenAnswer("access-2", "refresh-2") });
    await refreshSession("refresh-cached", "request-1");

    vi.advanceTimersByTime(29_000);
    const late = await refreshSession("refresh-cached", "request-2");

    expect(late).toEqual({ status: "renewed", tokens: RENEWED });
    expect(api.calls(REFRESH)).toHaveLength(1);
  });

  it("calls the API again once the 30 seconds have passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const api = fakeApi({ [REFRESH]: () => tokenAnswer("access-2", "refresh-2") });
    await refreshSession("refresh-expired", "request-1");

    vi.advanceTimersByTime(30_001);
    await refreshSession("refresh-expired", "request-2");

    expect(api.calls(REFRESH)).toHaveLength(2);
  });

  it.each([
    [
      "rejected",
      () => ({
        status: 401,
        body: { code: "invalid_refresh_token", message: "No.", details: null },
      }),
    ],
    [
      "unavailable",
      () => ({ status: 503, body: { code: "internal_error", message: "Down.", details: null } }),
    ],
    [
      "unavailable",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ] as const)(
    "is %s, and lets the next refresh reach the API rather than reusing that result",
    async (status, handler) => {
      const api = fakeApi({ [REFRESH]: handler });

      expect(await refreshSession("refresh-failing", "request-1")).toEqual({ status });
      expect(await refreshSession("refresh-failing", "request-2")).toEqual({ status });

      expect(api.calls(REFRESH)).toHaveLength(2);
    },
  );
});
