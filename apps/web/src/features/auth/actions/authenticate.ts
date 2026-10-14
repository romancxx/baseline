"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, formError, parseForm } from "@/shared/form-state";
import { ROUTES, safeRedirectPath } from "@/shared/routes";
import { createSupabaseServerClient } from "@/shared/supabase/server";

const CredentialsSchema = z.object({
  intent: z.enum(["sign-in", "sign-up"]),
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
  next: z
    .string()
    .transform((value) => safeRedirectPath(value) ?? ROUTES.dashboard)
    .catch(ROUTES.dashboard),
});

export async function authenticate(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(CredentialsSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { intent, email, password, next } = parsed.value;
  const supabase = await createSupabaseServerClient();

  const { error } =
    intent === "sign-up"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

  if (error) return formError(error.message);

  redirect(next);
}
