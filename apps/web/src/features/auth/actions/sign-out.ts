"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/shared/routes";
import { createSupabaseServerClient } from "@/shared/supabase/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
