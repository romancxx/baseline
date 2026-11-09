import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/shared/api/client";
import { isPublicRoute, MOVED_ROUTES, ROUTES } from "@/shared/routes";
import { clearSession, readSession, refreshSession, writeSession } from "@/shared/session";
import type { RefreshOutcome } from "@/types/session";

const MOVED_PERMANENTLY = 308;

/**
 * Runs before every page and action: redirects moved paths, assigns the request's ID, renews an
 * expired access token, and sends signed-out visitors to `/sign-in` and signed-in ones away from it.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const moved = MOVED_ROUTES[request.nextUrl.pathname];
  if (moved) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = moved;
    return NextResponse.redirect(redirect, MOVED_PERMANENTLY);
  }

  const requestId = randomUUID();
  request.headers.set(REQUEST_ID_HEADER, requestId);
  const refresh = await refreshIfNeeded(request, requestId);

  const { pathname } = request.nextUrl;
  const signedIn = readSession(request.cookies).status !== "signed-out";

  if (!signedIn && !isPublicRoute(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = ROUTES.signIn;
    redirect.search = "";
    redirect.searchParams.set("next", pathname);
    return respond(NextResponse.redirect(redirect), refresh);
  }

  if (signedIn && pathname === ROUTES.signIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = ROUTES.home;
    redirect.search = "";
    return respond(NextResponse.redirect(redirect), refresh);
  }

  return respond(NextResponse.next({ request }), refresh);
}

/** Refreshes a session whose access cookie expired, writing the result onto the request. */
async function refreshIfNeeded(
  request: NextRequest,
  requestId: string,
): Promise<RefreshOutcome | null> {
  const session = readSession(request.cookies);
  if (session.status !== "needs-refresh") return null;

  const outcome = await refreshSession(session.refreshToken, requestId);
  if (outcome.status === "renewed") writeSession(request.cookies, outcome.tokens);
  if (outcome.status === "rejected") clearSession(request.cookies);
  return outcome;
}

/** Gives the browser the renewed cookies, or clears them when the refresh was rejected. */
function respond(response: NextResponse, refresh: RefreshOutcome | null): NextResponse {
  if (refresh?.status === "renewed") writeSession(response.cookies, refresh.tokens);
  if (refresh?.status === "rejected") clearSession(response.cookies);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
