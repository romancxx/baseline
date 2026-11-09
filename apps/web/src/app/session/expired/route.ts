import { type NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/shared/routes";
import { clearSession } from "@/shared/session";

/** Clears the session the API refused while rendering, then sends the user to sign in. */
export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL(ROUTES.signIn, request.url));
  clearSession(response.cookies);
  return response;
}
