// @vitest-environment node
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, signIn, signOut } from "@/features/auth/actions/auth-actions";
import { IDLE } from "@/shared/form-state";
import type { ApiResult } from "@/types/api";

/** The browser's cookies, as an action's `cookies()` store sees them. */
let cookieStore = NextResponse.next().cookies;

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

/** The API's answers by path; every call through the client is recorded. */
const post = vi.fn<(path: string, init?: unknown) => Promise<ApiResult<unknown>>>();

vi.mock("@/shared/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/api/client")>()),
  createApiClient: () => ({ POST: post }),
  send: (call: Promise<ApiResult<unknown>>) => call,
}));

beforeEach(() => {
  cookieStore = NextResponse.next().cookies;
  post.mockReset();
});

const LOGIN = "/api/v1/auth/login";
const REGISTER = "/api/v1/auth/register";
const LOGOUT = "/api/v1/auth/logout";

/** Answers every call to `path` with `result`. */
function answer(path: string, result: ApiResult<unknown>): void {
  const others = post.getMockImplementation();
  post.mockImplementation(async (calledPath, init) =>
    calledPath === path ? result : others ? others(calledPath, init) : notFound(),
  );
}

function notFound(): ApiResult<unknown> {
  return { ok: false, error: apiError(404, "not_found") };
}

function apiError(status: number, code: string) {
  return { status, code, message: "The API said no.", details: null, requestId: "answered-1" };
}

/** The API's answer to a login, its refresh token in the cookie it sets. */
function signedIn(accessToken: string, refreshToken: string): ApiResult<unknown> {
  return {
    ok: true,
    data: { access_token: accessToken, token_type: "bearer", expires_in: 900 },
    response: new Response(null, {
      headers: [["set-cookie", `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth`]],
    }),
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("signing in", () => {
  it.each([
    [
      "a malformed email",
      { email: "alice", password: "correct-horse-battery" },
      "Enter a valid email address.",
    ],
    ["an empty password", { email: "alice@example.com", password: "" }, "Enter your password."],
  ])("refuses %s without calling the API", async (_, fields, message) => {
    expect(await signIn(IDLE, form(fields))).toEqual({ status: "error", message });
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ["the next page when it is on the site", "/portfolio", "/portfolio"],
    ["Review when next leaves the site", "//evil.example", "/"],
    ["Review without a next", null, "/"],
  ])("writes the session and redirects to %s", async (_, next, target) => {
    answer(LOGIN, signedIn("access-1", "refresh-1"));
    const fields = { email: "alice@example.com", password: "correct-horse-battery" };

    await expect(signIn(IDLE, form(next === null ? fields : { ...fields, next }))).rejects.toThrow(
      `NEXT_REDIRECT ${target}`,
    );

    expect(cookieStore.get("sn_access")?.value).toBe("access-1");
    expect(cookieStore.get("sn_refresh")?.value).toBe("refresh-1");
  });

  it.each([
    ["wrong credentials", apiError(401, "invalid_credentials"), "Wrong email or password"],
    ["any other failure", apiError(0, "network_error"), "Could not sign in. Try again."],
  ])("answers %s with a form error and no session", async (_, error, message) => {
    answer(LOGIN, { ok: false, error });

    const state = await signIn(
      IDLE,
      form({ email: "alice@example.com", password: "correct-horse-battery" }),
    );

    expect(state).toEqual({ status: "error", message });
    expect(cookieStore.has("sn_refresh")).toBe(false);
  });
});

describe("creating an account", () => {
  it.each([
    ["11", "a".repeat(11), "Use at least 12 characters for your password."],
    ["129", "a".repeat(129), "Use at most 128 characters for your password."],
  ])(
    "refuses a password of %s characters without calling the API",
    async (_, password, message) => {
      const state = await createAccount(IDLE, form({ email: "alice@example.com", password }));

      expect(state).toEqual({ status: "error", message });
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("registers the password exactly as typed, then signs in, writes the session and redirects", async () => {
    const password = "  twelve ch  ";
    answer(REGISTER, { ok: true, data: { id: "user-1" }, response: new Response() });
    answer(LOGIN, signedIn("access-1", "refresh-1"));

    await expect(
      createAccount(IDLE, form({ email: "alice@example.com", password, next: "/portfolio" })),
    ).rejects.toThrow("NEXT_REDIRECT /portfolio");

    expect(post).toHaveBeenCalledWith(REGISTER, {
      body: { email: "alice@example.com", password: "  twelve ch  " },
    });
    expect(post).toHaveBeenCalledWith(
      LOGIN,
      expect.objectContaining({ body: expect.objectContaining({ password }) }),
    );
    expect(cookieStore.get("sn_access")?.value).toBe("access-1");
    expect(cookieStore.get("sn_refresh")?.value).toBe("refresh-1");
  });

  const NEW_ACCOUNT = { email: "alice@example.com", password: "correct-horse-battery" };

  it("tells a taken email apart, without signing in", async () => {
    answer(REGISTER, { ok: false, error: apiError(409, "email_taken") });

    const state = await createAccount(IDLE, form(NEW_ACCOUNT));

    expect(state).toEqual({ status: "error", message: "This email already has an account" });
    expect(post).not.toHaveBeenCalledWith(LOGIN, expect.anything());
  });

  it("answers another registration failure with a generic message", async () => {
    answer(REGISTER, { ok: false, error: apiError(0, "network_error") });

    const state = await createAccount(IDLE, form(NEW_ACCOUNT));

    expect(state).toEqual({
      status: "error",
      message: "Could not create your account. Try again.",
    });
  });

  it("says the account exists and asks to sign in when registering worked but signing in failed", async () => {
    answer(REGISTER, { ok: true, data: { id: "user-1" }, response: new Response() });
    answer(LOGIN, { ok: false, error: apiError(503, "internal_error") });

    const state = await createAccount(IDLE, form(NEW_ACCOUNT));

    expect(state).toEqual({
      status: "error",
      message: "Your account was created. Sign in to continue.",
    });
    expect(cookieStore.has("sn_refresh")).toBe(false);
  });
});

describe("signing out", () => {
  it.each([
    [
      "the API logs out",
      { ok: true, data: undefined, response: new Response(null, { status: 204 }) },
    ],
    ["the API cannot be reached", { ok: false, error: apiError(0, "network_error") }],
  ] as const)(
    "ends the session at the API, clears the cookies and goes to /sign-in when %s",
    async (_, result) => {
      cookieStore.set("sn_access", "access-1");
      cookieStore.set("sn_refresh", "refresh-1");
      answer(LOGOUT, result);

      await expect(signOut()).rejects.toThrow("NEXT_REDIRECT /sign-in");

      expect(post).toHaveBeenCalledWith(LOGOUT, {
        headers: { Cookie: "refresh_token=refresh-1" },
      });
      expect(cookieStore.get("sn_access")?.value).toBe("");
      expect(cookieStore.get("sn_refresh")?.value).toBe("");
    },
  );
});
