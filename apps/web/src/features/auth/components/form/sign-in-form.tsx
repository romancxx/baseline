"use client";

import { useActionState } from "react";
import { authenticate } from "@/features/auth/actions/authenticate";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type SignInFormProps = {
  readonly next?: string | undefined;
};

export function SignInForm({ next }: SignInFormProps) {
  const [state, formAction] = useActionState(authenticate, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        label="Email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        type="password"
        name="password"
        required
        minLength={8}
        autoComplete="current-password"
        hint="At least 8 characters."
      />
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-detail">
          {state.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton name="intent" value="sign-in" label="Sign in" pendingLabel="Signing in…" />
        <SubmitButton
          name="intent"
          value="sign-up"
          variant="secondary"
          label="Create account"
          pendingLabel="Creating…"
        />
      </div>
    </form>
  );
}
