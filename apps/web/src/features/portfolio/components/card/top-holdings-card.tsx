import { TopHoldingRow } from "@/features/portfolio/components/row/top-holding-row";
import { seeAllLabel, topHoldings } from "@/features/portfolio/utils/holdings";
import { ROUTES } from "@/shared/routes";
import { Card } from "@/shared/ui/layout/card";
import { ButtonLink } from "@/shared/ui/navigation/button-link";
import type { PortfolioOverview } from "@/types/portfolio";

export type TopHoldingsCardProps = {
  readonly overview: PortfolioOverview;
};

export function TopHoldingsCard({ overview: { holdings, totals } }: TopHoldingsCardProps) {
  const top = topHoldings(holdings);

  return (
    <Card title="Holdings">
      {top.length === 0 ? (
        <p className="text-detail text-secondary">No holding is priced yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {top.map((holding) => (
            <TopHoldingRow key={holding.id} holding={holding} baseCurrency={totals.baseCurrency} />
          ))}
        </ul>
      )}
      <div className="mt-3">
        <ButtonLink href={ROUTES.holdings} variant="ghost" size="sm">
          {seeAllLabel(holdings.length)}
        </ButtonLink>
      </div>
    </Card>
  );
}
