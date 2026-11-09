import { z } from "zod";
import { ROUTES, safeRedirectPath } from "@/shared/routes";

const EmailSchema = z.email({ error: "Enter a valid email address." });

/** Where to go once signed in: a same-origin path, or Review. */
const NextPathSchema = z
  .string()
  .transform((value) => safeRedirectPath(value) ?? ROUTES.dashboard)
  .catch(ROUTES.dashboard);

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: "Enter your password." }),
  next: NextPathSchema,
});

export const CreateAccountSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(12, { error: "Use at least 12 characters for your password." })
    .max(128, { error: "Use at most 128 characters for your password." }),
  next: NextPathSchema,
});
