import { type NextRequest, NextResponse } from "next/server";
import { isPublicRoute, ROUTES } from "@/shared/routes";
import { updateSession } from "@/shared/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = ROUTES.signIn;
    // Preserve where they were headed, so the callback can send them back there.
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === ROUTES.signIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = ROUTES.dashboard;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files — those never need a session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
