"use client";

import { useActionState } from "react";
import { createAccount } from "@/features/auth/actions/auth-actions";
import { PasswordField } from "@/features/auth/components/input/password-field";
import { IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type CreateAccountFormProps = {
  readonly next?: string | undefined;
};

export function CreateAccountForm({ next }: CreateAccountFormProps) {
  const [state, action] = useActionState(createAccount, IDLE);

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
      <PasswordField
        label="Password"
        name="password"
        required
        minLength={12}
        maxLength={128}
        autoComplete="new-password"
        placeholder="At least 12 characters"
        hint="12 to 128 characters. Nothing else required."
      />
      {state.status === "error" ? <FormError message={state.message} /> : null}
      <SubmitButton label="Create account" pendingLabel="Creating your account…" />
    </form>
  );
}
