import type { ApiError } from "@/types/api";

/** A pair of tokens from the API. */
export type SessionTokens = {
  readonly accessToken: string;
  /** Seconds until the access token expires. */
  readonly expiresIn: number;
  readonly refreshToken: string;
};

/** What the cookies say; the JWT is never decoded. */
export type Session =
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly accessToken: string; readonly refreshToken: string }
  | { readonly status: "needs-refresh"; readonly refreshToken: string };

/** One session cookie, with its flags. */
export type SessionCookie = {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
  /** Seconds until the browser drops it. */
  readonly maxAge: number;
};

/**
 * A cookie store: Next's request or response cookies in `proxy.ts`, or `cookies()` in an action
 * or route handler. Request cookies keep only the name and value.
 */
export type SessionCookies = {
  get(name: string): { readonly value: string } | undefined;
  set(cookie: SessionCookie): unknown;
  delete(name: string): unknown;
};

export type Credentials = {
  readonly email: string;
  /** Exactly as typed, never trimmed. */
  readonly password: string;
};

/** A refresh's result: new tokens, the session over (a 401), or the API unavailable and the session kept. */
export type RefreshOutcome =
  | { readonly status: "renewed"; readonly tokens: SessionTokens }
  | { readonly status: "rejected" }
  | { readonly status: "unavailable" };

/** A refresh in flight, or settled and renewed until `expiresAt` (epoch ms). */
export type RefreshEntry = {
  readonly outcome: Promise<RefreshOutcome>;
  /** `null` while in flight. */
  expiresAt: number | null;
};

export type SessionResult =
  | { readonly ok: true; readonly tokens: SessionTokens }
  | { readonly ok: false; readonly error: ApiError };
