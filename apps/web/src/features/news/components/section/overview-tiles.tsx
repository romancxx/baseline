import { OverviewTile } from "@/features/news/components/card/overview-tile";
import { holdingsLine, lastGeneratedLine, pricedLine } from "@/features/news/utils/home";
import { formatMoney } from "@/shared/format";
import { PriceChange } from "@/shared/ui/display/price-change";
import type { BriefedSecurity } from "@/types/news";
import type { PortfolioOverview, PricedCount } from "@/types/portfolio";

export type OverviewTilesProps = {
  readonly overview: PortfolioOverview;
  /** `null` when no price or rate is missing. */
  readonly priced: PricedCount | null;
  readonly briefed: readonly BriefedSecurity[];
};

export function OverviewTiles({
  overview: { holdings, totals },
  priced,
  briefed,
}: OverviewTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-stack">
      <OverviewTile
        label="Total value"
        value={formatMoney(totals.value, totals.baseCurrency)}
        meta={holdingsLine(holdings.length, totals.baseCurrency)}
      />
      <OverviewTile
        label="Unrealised gain"
        value={<PriceChange value={totals.unrealisedGain} currency={totals.baseCurrency} />}
        meta={
          <>
            <PriceChange value={totals.unrealisedGainPct} unit="percent" />
            {priced === null ? null : <span>{pricedLine(priced)}</span>}
          </>
        }
      />
      <OverviewTile label="Briefs" value={briefed.length} meta={lastGeneratedLine(briefed)} />
    </div>
  );
}
