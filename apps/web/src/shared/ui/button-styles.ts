import { cn } from "@/shared/ui/cn";
import type { ButtonStyle } from "@/types/ui";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control border font-semibold motion-safe:transition disabled:opacity-disabled";

export const BUTTON_VARIANTS = {
  /** White: the one main action on a screen */
  primary: "border-transparent bg-inverse text-inverse hover:brightness-110",
  secondary: "border-hairline-strong bg-surface-raised text-primary hover:bg-surface-high",
} as const;

export const BUTTON_SIZES = {
  md: "min-h-button px-4 py-2 text-detail",
  sm: "min-h-button-sm px-3 py-1.5 text-caption",
} as const;

/** The classes of a button or a link styled as one. */
export function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle): string {
  return cn(BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size]);
}
