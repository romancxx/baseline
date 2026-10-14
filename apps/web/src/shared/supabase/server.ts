import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/shared/config/env";
import type { Database } from "@/shared/supabase/database.types";

/**
 * Request-scoped client for Server Components, Route Handlers and Server Actions. Reads
 * the session from cookies, so RLS applies as it does in the browser.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Harmless when middleware refreshes
            // the session; this catch is what the Supabase SSR guide prescribes.
          }
        },
      },
    },
  );
}

export { createSupabaseAdminClient } from "@/shared/supabase/admin";
