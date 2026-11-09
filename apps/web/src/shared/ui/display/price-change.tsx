import { formatMoney, formatPercent, MINUS } from "@/shared/format";
import { cn } from "@/shared/ui/cn";
import type { DecimalString } from "@/types/format";

export type PriceChangeProps = { readonly value: DecimalString | null } & (
  | { readonly unit: "percent" }
  | { readonly currency: string }
);

const DIRECTIONS = {
  up: "text-up",
  down: "text-down",
  flat: "text-secondary",
} as const;

/** The direction the shown text says, so the colour never disagrees with the sign. */
function direction(text: string): keyof typeof DIRECTIONS {
  if (text.startsWith("+")) return "up";
  if (text.startsWith(MINUS)) return "down";
  return "flat";
}

/** A price movement as bare text, sign first; the colour only supports the sign. */
export function PriceChange(props: PriceChangeProps) {
  const text =
    "unit" in props
      ? formatPercent(props.value, { signed: true })
      : formatMoney(props.value, props.currency, { signed: true });

  return (
    <span className={cn("font-medium font-mono tabular-nums", DIRECTIONS[direction(text)])}>
      {text}
    </span>
  );
}
