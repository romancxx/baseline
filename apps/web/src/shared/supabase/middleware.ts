import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { clientEnv } from "@/shared/config/env";
import type { Database } from "@/shared/supabase/database.types";

/**
 * Refreshes the auth session on every request and writes the rotated cookies onto the
 * response. Server Components cannot set cookies, so without this the access token would
 * expire mid-session and users would be silently signed out.
 *
 * The returned response must be the one the middleware returns: creating a new
 * `NextResponse` afterwards drops the refreshed cookies.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser` revalidates the token against Auth. Do not replace it with `getSession`,
  // which trusts whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
