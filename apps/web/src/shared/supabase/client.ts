import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/shared/config/env";
import type { Database } from "@/shared/supabase/database.types";

/**
 * Browser client. Carries the signed-in user's session, so every query is subject to RLS.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
