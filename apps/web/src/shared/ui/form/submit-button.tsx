"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/shared/ui/button-styles";
import type { ButtonStyle } from "@/types/ui";

export type SubmitButtonProps = ButtonStyle & {
  readonly label: string;
  readonly pendingLabel: string;
  /** Submits the form to this action instead of the form's own, so one form can carry several. */
  readonly formAction?: ((formData: FormData) => void) | undefined;
};

export function SubmitButton({
  label,
  pendingLabel,
  variant,
  size,
  formAction,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={buttonClasses({ variant, size })}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
