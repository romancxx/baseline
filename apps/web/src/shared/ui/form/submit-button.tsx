"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/shared/ui/cn";

export type SubmitButtonProps = {
  readonly label: string;
  readonly pendingLabel: string;
  readonly variant?: keyof typeof VARIANTS;
  /** Submitted with the form, so one form can carry several intents. */
  readonly name?: string;
  readonly value?: string;
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
  name,
  value,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn("disabled:opacity-disabled", VARIANTS[variant])}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
