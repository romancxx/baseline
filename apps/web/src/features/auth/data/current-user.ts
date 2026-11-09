import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ROUTES } from "@/shared/routes";
import { createSupabaseServerClient } from "@/shared/supabase/server";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * For server code that cannot run without a user. The middleware already redirects
 * anonymous traffic; this narrows the type and covers the paths it does not match.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(ROUTES.signIn);
  }
  return user;
}
