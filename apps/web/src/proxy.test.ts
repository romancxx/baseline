// @vitest-environment node
import { getRedirectUrl } from "next/experimental/testing/server";
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { fakeApi } from "@/shared/api/fake-api";

const SIGNED_IN = "sn_access=access-1; sn_refresh=refresh-1";

afterEach(() => {
  vi.unstubAllGlobals();
});

function visit(path: string, headers: Record<string, string> = {}): Promise<NextResponse> {
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
}

/** Whether the response lets the request through to the page. */
function continues(response: NextResponse): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("gating", () => {
  it("sends an anonymous visitor on a private page to /sign-in, remembering the page", async () => {
    fakeApi({});

    const response = await visit("/portfolio");

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/sign-in?next=%2Fportfolio");
  });

  it.each(["/sign-in", "/session/expired"])("lets an anonymous visitor open %s", async (path) => {
    fakeApi({});

    expect(continues(await visit(path))).toBe(true);
  });

  it("sends a signed-in user on /sign-in to Review", async () => {
    fakeApi({});

    const response = await visit("/sign-in?next=%2Fportfolio", { cookie: SIGNED_IN });

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/");
  });

  it("lets a signed-in user through to a private page", async () => {
    const api = fakeApi({});

    expect(continues(await visit("/portfolio", { cookie: SIGNED_IN }))).toBe(true);
    expect(api.requests).toHaveLength(0);
  });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A header of the request Next forwards to the page. */
function forwarded(response: NextResponse, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe("the request ID", () => {
  it("is a new UUID for each request, forwarded to the page", async () => {
    fakeApi({});

    const first = forwarded(await visit("/portfolio", { cookie: SIGNED_IN }), "x-request-id");
    const second = forwarded(await visit("/portfolio", { cookie: SIGNED_IN }), "x-request-id");

    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(second).not.toBe(first);
  });

  it("replaces one sent by the browser", async () => {
    fakeApi({});

    const response = await visit("/portfolio", { cookie: SIGNED_IN, "x-request-id": "planted" });

    expect(forwarded(response, "x-request-id")).toMatch(UUID);
  });
});

const REFRESH = "POST /api/v1/auth/refresh";

function renewed(accessToken: string, refreshToken: string) {
  return () => ({
    status: 200,
    body: { access_token: accessToken, token_type: "bearer", expires_in: 900 },
    headers: [
      ["set-cookie", `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth`],
    ] as const,
  });
}

describe("an expired access token", () => {
  it("is renewed before the page renders: the browser keeps the new cookies and the page reads them", async () => {
    const api = fakeApi({ [REFRESH]: renewed("access-new", "refresh-new") });

    const response = await visit("/portfolio", { cookie: "sn_refresh=refresh-old" });

    expect(continues(response)).toBe(true);
    expect(response.cookies.get("sn_access")?.value).toBe("access-new");
    expect(response.cookies.get("sn_refresh")?.value).toBe("refresh-new");
    expect(forwarded(response, "cookie")).toBe("sn_refresh=refresh-new; sn_access=access-new");
    const [refresh] = api.calls(REFRESH);
    expect(refresh?.headers.get("cookie")).toBe("refresh_token=refresh-old");
    expect(refresh?.headers.get("x-request-id")).toBe(forwarded(response, "x-request-id"));
  });

  it("is renewed before deciding about /sign-in, which then sends the user to Review with the new cookies", async () => {
    fakeApi({ [REFRESH]: renewed("access-new", "refresh-new") });

    const response = await visit("/sign-in", { cookie: "sn_refresh=refresh-on-sign-in" });

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/");
    expect(response.cookies.get("sn_refresh")?.value).toBe("refresh-new");
  });

  it("whose refresh the API rejects sends the user to /sign-in with both cookies cleared", async () => {
    fakeApi({
      [REFRESH]: () => ({
        status: 401,
        body: { code: "invalid_refresh_token", message: "Revoked.", details: null },
      }),
    });

    const response = await visit("/portfolio", { cookie: "sn_refresh=refresh-revoked" });

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/sign-in?next=%2Fportfolio");
    for (const name of ["sn_access", "sn_refresh"]) {
      expect(response.cookies.get(name)).toMatchObject({ value: "", expires: new Date(0) });
    }
  });

  it.each([
    [
      "a server error",
      () => ({ status: 503, body: { code: "internal_error", message: "Down.", details: null } }),
    ],
    [
      "an unreachable API",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("lets the request through after %s, with the cookies untouched", async (_, handler) => {
    fakeApi({ [REFRESH]: handler });

    const response = await visit("/portfolio", { cookie: "sn_refresh=refresh-during-outage" });

    expect(continues(response)).toBe(true);
    expect(response.cookies.getAll()).toEqual([]);
  });
});
