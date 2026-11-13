import type { Route } from "@/types/routes";

export const ROUTES = {
  home: "/",
  holdings: "/holdings",
  holdingsImport: "/holdings/import",
  search: "/search",
  sessionExpired: "/session/expired",
  signIn: "/sign-in",
} as const;

/** Reachable without a session */
export const PUBLIC_ROUTES: readonly Route[] = [ROUTES.signIn, ROUTES.sessionExpired];

/** Paths that moved, and the route each now lives at; redirected permanently. */
export const MOVED_ROUTES: Readonly<Record<string, Route>> = {
  "/portfolio": ROUTES.holdings,
};

export function instrumentRoute(instrumentId: string) {
  return `/instruments/${instrumentId}` as const;
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Base for resolving relative paths; never requested.
const SAME_ORIGIN = "http://same-origin.invalid";

/** Same-origin path for a user-supplied redirect target, or `null` if it would leave the site. */
export function safeRedirectPath(target: string): string | null {
  if (!target.startsWith("/")) return null;

  let url: URL;
  try {
    url = new URL(target, SAME_ORIGIN);
  } catch {
    return null;
  }

  return url.origin === SAME_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : null;
}
