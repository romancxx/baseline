import { z } from "zod";
import { ROUTES, safeRedirectPath } from "@/shared/routes";

/** The API's bounds on a new password, in characters. */
export const PASSWORD_LENGTH = { min: 12, max: 128 } as const;

const EmailSchema = z.email({ error: "Enter a valid email address." });

/** Where to go once signed in: a same-origin path, or Home. */
const NextPathSchema = z
  .string()
  .transform((value) => safeRedirectPath(value) ?? ROUTES.home)
  .catch(ROUTES.home);

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: "Enter your password." }),
  next: NextPathSchema,
});

export const CreateAccountSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(PASSWORD_LENGTH.min, {
      error: `Use at least ${PASSWORD_LENGTH.min} characters for your password.`,
    })
    .max(PASSWORD_LENGTH.max, {
      error: `Use at most ${PASSWORD_LENGTH.max} characters for your password.`,
    }),
  next: NextPathSchema,
});
