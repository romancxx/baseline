import { createHash } from "node:crypto";
import type { components } from "@/shared/api/api.types";
import { createApiClient, send, unexpectedResponse } from "@/shared/api/client";
import { serverEnv } from "@/shared/config/server-env";
import { logger } from "@/shared/logger";
import type {
  Credentials,
  RefreshEntry,
  RefreshOutcome,
  Session,
  SessionCookieOptions,
  SessionCookies,
  SessionResult,
  SessionTokens,
} from "@/types/session";

const ACCESS_COOKIE = "sn_access";
const REFRESH_COOKIE = "sn_refresh";
/** The API's own refresh cookie, read from its `Set-Cookie` and sent back in `Cookie`. */
const API_REFRESH_COOKIE = "refresh_token";

/** The access cookie expires this many seconds before its token. */
const ACCESS_EARLY_EXPIRY_SECONDS = 60;
const REFRESH_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const UNAUTHORIZED = 401;
/** How long a renewal is given to requests still carrying the token it replaced. */
const RENEWAL_REUSE_MS = 30_000;

export function readSession(cookies: Pick<SessionCookies, "get">): Session {
  const refreshToken = cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return { status: "signed-out" };

  const accessToken = cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return { status: "needs-refresh", refreshToken };

  return { status: "signed-in", accessToken, refreshToken };
}

/** Writes the tokens into the session cookies. */
export function writeSession(cookies: Pick<SessionCookies, "set">, tokens: SessionTokens): void {
  cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions(),
    maxAge: tokens.expiresIn - ACCESS_EARLY_EXPIRY_SECONDS,
  });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions(),
    maxAge: REFRESH_LIFETIME_SECONDS,
  });
}

export function clearSession(cookies: Pick<SessionCookies, "delete">): void {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}

/** Signs in at the API; the caller writes the tokens. */
export async function createSession(
  { email, password }: Credentials,
  requestId: string | null,
): Promise<SessionResult> {
  const api = createApiClient({ requestId });
  const result = await send(
    api.POST("/api/v1/auth/login", {
      body: { username: email, password, scope: "" },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  );
  if (!result.ok) return result;

  return toTokens(result.data, result.response);
}

/** Revokes the refresh token at the API, then clears the cookies whatever the API answered. */
export async function endSession(cookies: SessionCookies, requestId: string | null): Promise<void> {
  const session = readSession(cookies);
  if (session.status !== "signed-out") {
    const api = createApiClient({ requestId });
    const result = await send(
      api.POST("/api/v1/auth/logout", {
        headers: { Cookie: `${API_REFRESH_COOKIE}=${session.refreshToken}` },
      }),
    );
    if (!result.ok) {
      const { status, code } = result.error;
      logger.warn("auth.sign_out_failed", { status, code, requestId });
    }
  }
  clearSession(cookies);
}

/** Refreshes in flight, then renewed for `RENEWAL_REUSE_MS`, by their refresh token's SHA-256. */
const refreshes = new Map<string, RefreshEntry>();

/**
 * Exchanges a refresh token for new tokens. Callers with the same token share one API call, and
 * its new tokens for `RENEWAL_REUSE_MS` after; the caller writes the tokens.
 */
export function refreshSession(
  refreshToken: string,
  requestId: string | null,
): Promise<RefreshOutcome> {
  forgetExpiredRefreshes();
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const known = refreshes.get(key);
  if (known) return known.outcome;

  const entry: RefreshEntry = { outcome: requestRefresh(refreshToken, requestId), expiresAt: null };
  refreshes.set(key, entry);
  entry.outcome.then((outcome) => {
    if (outcome.status === "renewed") entry.expiresAt = Date.now() + RENEWAL_REUSE_MS;
    else refreshes.delete(key);
  });
  return entry.outcome;
}

function forgetExpiredRefreshes(): void {
  const now = Date.now();
  for (const [key, { expiresAt }] of refreshes) {
    if (expiresAt !== null && expiresAt <= now) refreshes.delete(key);
  }
}

async function requestRefresh(
  refreshToken: string,
  requestId: string | null,
): Promise<RefreshOutcome> {
  const api = createApiClient({ requestId });
  const result = await send(
    api.POST("/api/v1/auth/refresh", {
      headers: { Cookie: `${API_REFRESH_COOKIE}=${refreshToken}` },
    }),
  );
  const tokens = result.ok ? toTokens(result.data, result.response) : result;
  if (tokens.ok) return { status: "renewed", tokens: tokens.tokens };

  const { status, code } = tokens.error;
  logger.warn("auth.refresh_failed", { status, code, requestId });
  return status === UNAUTHORIZED ? { status: "rejected" } : { status: "unavailable" };
}

function toTokens(data: components["schemas"]["TokenResponse"], response: Response): SessionResult {
  const refreshToken = apiRefreshToken(response);
  if (refreshToken === null) return { ok: false, error: unexpectedResponse(response) };

  return {
    ok: true,
    tokens: { accessToken: data.access_token, expiresIn: data.expires_in, refreshToken },
  };
}

/** The refresh token in the API's `Set-Cookie`, or `null` when it sets none. */
function apiRefreshToken(response: Response): string | null {
  const prefix = `${API_REFRESH_COOKIE}=`;
  for (const cookie of response.headers.getSetCookie()) {
    if (!cookie.startsWith(prefix)) continue;
    const value = cookie.slice(prefix.length).split(";")[0];
    if (value) return value;
  }
  return null;
}

function cookieOptions(): Omit<SessionCookieOptions, "maxAge"> {
  return {
    httpOnly: true,
    secure: new URL(serverEnv.NEXT_PUBLIC_APP_URL).protocol === "https:",
    sameSite: "lax",
    path: "/",
  };
}
