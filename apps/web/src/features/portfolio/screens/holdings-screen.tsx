import { resolveInstrument } from "@/features/instruments/server";
import { editPosition, removePosition } from "@/features/portfolio/actions/position-actions";
import { ImportedNotice } from "@/features/portfolio/components/display/imported-notice";
import { MissingPricesNotice } from "@/features/portfolio/components/display/missing-prices-notice";
import { HoldingsTable } from "@/features/portfolio/components/list/holdings-table";
import { HoldingsHeader } from "@/features/portfolio/components/section/holdings-header";
import { getPortfolioOverview } from "@/features/portfolio/data/portfolio-overview";
import { ImportedCountsSchema } from "@/features/portfolio/schemas/import.schema";
import { holdingsSummary, pricedCount } from "@/features/portfolio/utils/holdings";
import { importedSummary } from "@/features/portfolio/utils/import";

export type HoldingsScreenProps = {
  /** Counts of rows by status after an import, from `importedHoldingsRoute`. */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function HoldingsScreen({ searchParams }: HoldingsScreenProps) {
  const [overview, query] = await Promise.all([getPortfolioOverview(), searchParams]);
  const { holdings, totals } = overview;
  const priced = pricedCount(overview);
  const imported = importedSummary(ImportedCountsSchema.parse(query));

  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <HoldingsHeader
        summary={holdings.length === 0 ? null : holdingsSummary(holdings.length, totals)}
        resolveInstrument={resolveInstrument}
      />
      {imported === null ? null : <ImportedNotice summary={imported} />}
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
