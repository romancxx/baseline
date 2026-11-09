"use client";

import { useActionState } from "react";
import { signIn } from "@/features/auth/actions/auth-actions";
import { PasswordField } from "@/features/auth/components/input/password-field";
import { IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type SignInFormProps = {
  readonly next?: string | undefined;
};

export function SignInForm({ next }: SignInFormProps) {
  const [state, action] = useActionState(signIn, IDLE);

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        label="Email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />
      <PasswordField label="Password" name="password" required autoComplete="current-password" />
      {state.status === "error" ? <FormError message={state.message} /> : null}
      <SubmitButton label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
