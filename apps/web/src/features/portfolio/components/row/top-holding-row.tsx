import Link from "next/link";
import { InstrumentAvatar } from "@/features/instruments";
import { weightLine } from "@/features/portfolio/utils/holdings";
import { formatMoney } from "@/shared/format";
import { instrumentRoute } from "@/shared/routes";
import type { Holding } from "@/types/portfolio";

export type TopHoldingRowProps = {
  readonly holding: Holding;
  readonly baseCurrency: string;
};

export function TopHoldingRow({ holding, baseCurrency }: TopHoldingRowProps) {
  const { instrument } = holding;

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <InstrumentAvatar instrument={instrument} size="sm" />
        <Link
          href={instrumentRoute(instrument.id)}
          className="truncate font-semibold text-body text-primary hover:underline"
        >
          {instrument.name}
        </Link>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-body text-primary tabular-nums">
          {formatMoney(holding.value, instrument.currency)}
        </span>
        <span className="font-mono text-caption text-tertiary tabular-nums">
          {weightLine(holding, baseCurrency)}
        </span>
      </div>
    </li>
  );
}
