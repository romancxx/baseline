import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readApi } from "@/shared/api/request";
import { ROUTES } from "@/shared/routes";
import { readSession } from "@/shared/session";
import type { User } from "@/types/auth";

/** The signed-in user, read once per request from the API; `null` without a session. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (readSession(await cookies()).status === "signed-out") return null;

  const user = await readApi("load the user", (api) => api.GET("/api/v1/users/me"));
  return { id: user.id, email: user.email };
});

/**
 * For server code that cannot run without a user. `proxy.ts` already redirects anonymous
 * traffic; this narrows the type and covers the paths it does not match.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(ROUTES.signIn);
  }
  return user;
}
