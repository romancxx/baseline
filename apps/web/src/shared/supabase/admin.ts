import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/shared/config/env";
import { serverEnv } from "@/shared/config/server-env";
import type { Database } from "@/shared/supabase/database.types";

/**
 * Bypasses RLS. For ingest, summarisation and digest generation — background work that
 * belongs to no user. Never reachable from a request made on a user's behalf.
 *
 * Kept out of `./server` so scripts can import it without pulling in `next/headers`.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
