"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses } from "@/shared/ui/button-styles";
import type { ButtonStyle } from "@/types/ui";

export type SubmitButtonProps = ButtonStyle & {
  readonly label: string;
  readonly pendingLabel: string;
};

export function SubmitButton({ label, pendingLabel, variant, size }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={buttonClasses({ variant, size })}>
      {pending ? pendingLabel : label}
    </button>
  );
}
