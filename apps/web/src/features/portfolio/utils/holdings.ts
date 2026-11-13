import { formatMoney } from "@/shared/format";
import type { Holding, PortfolioOverview, PortfolioTotals, PricedCount } from "@/types/portfolio";

/** "12 securities · €48,210.35 total · values converted to EUR where they differ" */
export function holdingsSummary(count: number, { value, baseCurrency }: PortfolioTotals): string {
  const parts = [`${count} ${count === 1 ? "security" : "securities"}`];
  if (value !== null) parts.push(`${formatMoney(value, baseCurrency)} total`);
  parts.push(`values converted to ${baseCurrency} where they differ`);
  return parts.join(" · ");
}

/** How many holdings with a quantity are priced; `null` unless a price or a rate is missing. */
export function pricedCount({ holdings, totals }: PortfolioOverview): PricedCount | null {
  const missing = holdings.some(
    ({ unvaluedReason }) => unvaluedReason === "no_price" || unvaluedReason === "no_rate",
  );
  if (!missing) return null;

  return {
    priced: totals.valuedCount,
    of: holdings.filter(({ quantity }) => quantity !== null).length,
  };
}

/** Whether the value in the base currency goes under the value in the listing's own. */
export function showsBaseValue(holding: Holding, baseCurrency: string): boolean {
  return holding.instrument.currency !== baseCurrency && holding.valueBase !== null;
}
