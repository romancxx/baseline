"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/shared/ui/cn";

export type SubmitButtonProps = {
  readonly label: string;
  readonly pendingLabel: string;
  readonly variant?: keyof typeof VARIANTS;
  /** Submits the form to this action instead of the form's own, so one form can carry several. */
  readonly formAction?: ((formData: FormData) => void) | undefined;
};

const BOXED = "rounded-control border px-control-x py-control-y text-label";

const VARIANTS = {
  primary: cn(BOXED, "border-transparent bg-inverse text-inverse"),
  secondary: cn(BOXED, "border-hairline text-primary"),
  quiet: "text-caption text-tertiary hover:text-primary",
} as const;

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  formAction,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={cn("disabled:opacity-disabled", VARIANTS[variant])}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
