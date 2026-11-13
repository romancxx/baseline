import { resolveInstrument } from "@/features/instruments/server";
import { editPosition, removePosition } from "@/features/portfolio/actions/position-actions";
import { MissingPricesNotice } from "@/features/portfolio/components/display/missing-prices-notice";
import { HoldingsTable } from "@/features/portfolio/components/list/holdings-table";
import { HoldingsHeader } from "@/features/portfolio/components/section/holdings-header";
import { getPortfolioOverview } from "@/features/portfolio/data/portfolio-overview";
import { holdingsSummary, pricedCount } from "@/features/portfolio/utils/holdings";

export async function HoldingsScreen() {
  const overview = await getPortfolioOverview();
  const { holdings, totals } = overview;
  const priced = pricedCount(overview);

  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <HoldingsHeader
        summary={holdings.length === 0 ? null : holdingsSummary(holdings.length, totals)}
        resolveInstrument={resolveInstrument}
      />
      {priced === null ? null : <MissingPricesNotice count={priced} />}
      <HoldingsTable
        holdings={holdings}
        baseCurrency={totals.baseCurrency}
        editPosition={editPosition}
        removePosition={removePosition}
        resolveInstrument={resolveInstrument}
      />
    </div>
  );
}
