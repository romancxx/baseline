import { Upload } from "lucide-react";
import { HOLDINGS_COLUMNS } from "@/features/portfolio/components/list/holdings-columns";
import { HoldingRow } from "@/features/portfolio/components/row/holding-row";
import { ROUTES } from "@/shared/routes";
import { cn } from "@/shared/ui/cn";
import { Icon } from "@/shared/ui/display/icon";
import { ButtonLink } from "@/shared/ui/navigation/button-link";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

export type HoldingsTableProps = {
  readonly holdings: readonly Holding[];
  readonly baseCurrency: string;
  readonly editPosition: FormAction;
  readonly removePosition: FormAction;
};

export function HoldingsTable({
  holdings,
  baseCurrency,
  editPosition,
  removePosition,
}: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-hairline border-dashed px-card py-10 text-center">
        <h2 className="font-serif text-headline">Nothing here yet</h2>
        <p className="max-w-prose text-detail text-secondary">
          Add what you hold and the first briefs arrive after the next update. A quantity is
          optional — you can track a security without one.
        </p>
        <div className="mt-3 flex gap-2">
          <ButtonLink href={ROUTES.holdingsImport} variant="secondary">
            <Icon icon={Upload} />
            Import a CSV
          </ButtonLink>
        </div>
      </div>
    );
  }

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
