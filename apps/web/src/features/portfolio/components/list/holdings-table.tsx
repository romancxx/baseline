import { HOLDINGS_COLUMNS } from "@/features/portfolio/components/list/holdings-columns";
import { HoldingRow } from "@/features/portfolio/components/row/holding-row";
import { EmptyPortfolio } from "@/features/portfolio/components/section/empty-portfolio";
import { cn } from "@/shared/ui/cn";
import type { FormAction } from "@/types/form-state";
import type { ResolveInstrument } from "@/types/instruments";
import type { Holding } from "@/types/portfolio";

export type HoldingsTableProps = {
  readonly holdings: readonly Holding[];
  readonly baseCurrency: string;
  readonly editPosition: FormAction;
  readonly removePosition: FormAction;
  readonly resolveInstrument: ResolveInstrument;
};

export function HoldingsTable({
  holdings,
  baseCurrency,
  editPosition,
  removePosition,
  resolveInstrument,
}: HoldingsTableProps) {
  if (holdings.length === 0) return <EmptyPortfolio resolveInstrument={resolveInstrument} />;

  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr className="border-hairline-strong border-b">
          {HOLDINGS_COLUMNS.map(({ label, numeric }) => (
            <th
              key={label}
              scope="col"
              className={cn(
                "whitespace-nowrap px-3 pb-2 text-overline text-tertiary uppercase",
                numeric ? "text-right" : "text-left",
              )}
            >
              {label === "Actions" ? <span className="sr-only">{label}</span> : label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {holdings.map((holding) => (
          <HoldingRow
            key={holding.id}
            holding={holding}
            baseCurrency={baseCurrency}
            editPosition={editPosition}
            removePosition={removePosition}
          />
        ))}
      </tbody>
    </table>
  );
}
