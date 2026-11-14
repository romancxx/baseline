import { direction, formatMoney, formatPercent } from "@/shared/format";
import { cn } from "@/shared/ui/cn";
import type { DecimalString, Direction } from "@/types/format";

export type PriceChangeProps = { readonly value: DecimalString | null } & (
  | { readonly unit: "percent" }
  | { readonly currency: string }
);

const DIRECTIONS = {
  up: "text-up",
  down: "text-down",
  flat: "text-secondary",
} as const satisfies Record<Direction, string>;

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
