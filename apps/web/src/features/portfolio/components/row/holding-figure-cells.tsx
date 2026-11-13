import { NUMERIC_CELL } from "@/features/portfolio/components/list/holdings-columns";
import { showsBaseValue } from "@/features/portfolio/utils/holdings";
import { formatMoney, formatPercent } from "@/shared/format";
import { cn } from "@/shared/ui/cn";
import { PriceChange } from "@/shared/ui/display/price-change";
import type { Holding } from "@/types/portfolio";

export type HoldingFigureCellsProps = {
  readonly holding: Holding;
  readonly baseCurrency: string;
};

export function HoldingFigureCells({ holding, baseCurrency }: HoldingFigureCellsProps) {
  const { currency } = holding.instrument;

  return (
    <>
      <td className={cn(NUMERIC_CELL, holding.latestClose === null && "text-tertiary")}>
        {formatMoney(holding.latestClose, currency)}
      </td>
      <td className={cn(NUMERIC_CELL, holding.value === null && "text-tertiary")}>
        <span className="font-medium">{formatMoney(holding.value, currency)}</span>
        {showsBaseValue(holding, baseCurrency) ? (
          <span className="block text-caption text-tertiary">
            {formatMoney(holding.valueBase, baseCurrency)}
          </span>
        ) : null}
      </td>
      <td className={cn(NUMERIC_CELL, holding.unrealisedGain === null && "text-tertiary")}>
        {holding.unrealisedGain === null ? (
          formatMoney(null, currency)
        ) : (
          <>
            <PriceChange value={holding.unrealisedGain} currency={currency} />
            <span className="block text-caption">
              <PriceChange value={holding.unrealisedGainPct} unit="percent" />
            </span>
          </>
        )}
      </td>
      <td className={cn(NUMERIC_CELL, holding.weight === null && "text-tertiary")}>
        {formatPercent(holding.weight)}
      </td>
    </>
  );
}
