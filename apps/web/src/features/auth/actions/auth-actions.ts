"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CreateAccountSchema, SignInSchema } from "@/features/auth/schemas/credentials.schema";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { formError, parseForm } from "@/shared/form-state";
import { logger } from "@/shared/logger";
import { ROUTES } from "@/shared/routes";
import { createSession, endSession, writeSession } from "@/shared/session";
import type { ApiError } from "@/types/api";
import type { FormState } from "@/types/form-state";

const INVALID_CREDENTIALS = "invalid_credentials";
const EMAIL_TAKEN = "email_taken";

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(SignInSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { email, password, next } = parsed.value;
  const requestId = await currentRequestId();
  const session = await createSession({ email, password }, requestId);
  if (!session.ok) {
    if (session.error.code === INVALID_CREDENTIALS) return formError("Wrong email or password");
    logFailure("auth.sign_in_failed", session.error, requestId);
    return formError("Could not sign in. Try again.");
  }

  writeSession(await cookies(), session.tokens);
  redirect(next);
}

export async function createAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(CreateAccountSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { email, password, next } = parsed.value;
  const requestId = await currentRequestId();
  const registered = await resultOf(
    api.POST("/api/v1/auth/register", { body: { email, password } }),
  );
  if (!registered.ok) {
    if (registered.error.code === EMAIL_TAKEN)
      return formError("This email already has an account");
    logFailure("auth.create_account_failed", registered.error, requestId);
    return formError("Could not create your account. Try again.");
  }

  const session = await createSession({ email, password }, requestId);
  if (!session.ok) {
    logFailure("auth.sign_in_failed", session.error, requestId);
    return formError("Your account was created. Sign in to continue.");
  }

  writeSession(await cookies(), session.tokens);
  redirect(next);
}

export async function signOut(): Promise<void> {
  await endSession(await cookies(), await currentRequestId());
  redirect(ROUTES.signIn);
}

function logFailure(event: string, { status, code }: ApiError, requestId: string | null): void {
  logger.warn(event, { status, code, requestId });
}
