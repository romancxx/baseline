"use client";

import { useActionState, useState } from "react";
import { createAccount, signIn } from "@/features/auth/actions/auth-actions";
import { type FormState, IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type SignInFormProps = {
  readonly next?: string | undefined;
};

export function SignInForm({ next }: SignInFormProps) {
  const [signInState, signInAction] = useActionState(signIn, IDLE);
  const [createState, createAction] = useActionState(createAccount, IDLE);
  const latest = useLatest(signInState, createState);

  return (
    <form action={signInAction} className="flex flex-col gap-4">
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
        minLength={12}
        maxLength={128}
        autoComplete="current-password"
        hint="12 to 128 characters."
      />
      {latest.status === "error" ? (
        <p role="alert" className="text-danger text-detail">
          {latest.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton formAction={signInAction} label="Sign in" pendingLabel="Signing in…" />
        <SubmitButton
          formAction={createAction}
          variant="secondary"
          label="Create account"
          pendingLabel="Creating…"
        />
      </div>
    </form>
  );
}

/** The state of whichever action answered last. */
function useLatest(signInState: FormState, createState: FormState): FormState {
  // A form posted without JavaScript renders first with its action's state already set.
  const initial = createState.status === "idle" ? signInState : createState;
  const [seen, setSeen] = useState({ signInState, createState, latest: initial });
  if (seen.signInState === signInState && seen.createState === createState) return seen.latest;

  const latest = seen.signInState === signInState ? createState : signInState;
  setSeen({ signInState, createState, latest });
  return latest;
}
