import { showsBaseValue } from "@/features/portfolio/utils/holdings";
import { formatMoney, formatPercent, formatQuantity } from "@/shared/format";
import { PriceChange } from "@/shared/ui/display/price-change";
import type { Holding } from "@/types/portfolio";

export type PositionFiguresProps = {
  readonly holding: Holding;
  readonly baseCurrency: string;
};

const ROW =
  "flex items-baseline justify-between gap-4 border-hairline border-b py-2 last:border-b-0";
const LABEL = "text-detail text-secondary";
const FIGURE = "text-right font-mono text-detail text-primary tabular-nums";

export function PositionFigures({ holding, baseCurrency }: PositionFiguresProps) {
  const { currency } = holding.instrument;

  return (
    <dl>
      <div className={ROW}>
        <dt className={LABEL}>Quantity</dt>
        <dd className={FIGURE}>{formatQuantity(holding.quantity)}</dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>Average price</dt>
        <dd className={FIGURE}>{formatMoney(holding.averagePrice, currency)}</dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>Value</dt>
        <dd className={FIGURE}>
          {formatMoney(holding.value, currency)}
          {showsBaseValue(holding, baseCurrency) ? (
            <span className="block text-caption text-tertiary">
              {formatMoney(holding.valueBase, baseCurrency)}
            </span>
          ) : null}
        </dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>Unrealised</dt>
        <dd className={FIGURE}>
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
        </dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>Weight</dt>
        <dd className={FIGURE}>{formatPercent(holding.weight)}</dd>
      </div>
    </dl>
  );
}
