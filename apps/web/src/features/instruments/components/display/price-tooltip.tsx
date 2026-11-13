import { closeOn } from "@/features/instruments/utils/price-chart";
import { formatDate, formatMoney } from "@/shared/format";
import type { DailyClose } from "@/types/instruments";

export type PriceTooltipProps = {
  readonly active: boolean | undefined;
  /** The hovered point's date, as Recharts passes it. */
  readonly label: unknown;
  readonly closes: readonly DailyClose[];
  readonly currency: string;
};

export function PriceTooltip({ active, label, closes, currency }: PriceTooltipProps) {
  const close = active ? closeOn(closes, label) : null;
  if (close === null) return null;

  return (
    <p className="flex items-center gap-2.5 rounded-control border border-hairline-strong bg-surface-raised px-3 py-1.5 font-mono text-caption">
      <span className="text-tertiary uppercase">{formatDate(close.date, "dayYear")}</span>
      <span className="text-primary">Close {formatMoney(close.close, currency)}</span>
    </p>
  );
}
