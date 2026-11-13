import { formatMoney } from "@/shared/format";
import type { Instrument } from "@/types/instruments";
import type {
  Holding,
  HoldingStatus,
  PortfolioOverview,
  PortfolioTotals,
  PricedCount,
} from "@/types/portfolio";

/** A holding without a quantity has no position, so its card is not titled after one. */
export function positionCardTitle(status: HoldingStatus): string {
  return status === "no-position" ? "Your holding" : "Your position";
}

/** "Edit LVMH": the button's name, since every row has an Edit and a Remove. */
export function rowActionLabel(action: "Edit" | "Remove", { name }: Instrument): string {
  return `${action} ${name}`;
}

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

export function findHolding(overview: PortfolioOverview, instrumentId: string): Holding | null {
  return overview.holdings.find(({ instrument }) => instrument.id === instrumentId) ?? null;
}

export function holdingStatus(holding: Holding | null): HoldingStatus {
  if (holding === null) return "not-held";
  if (holding.unvaluedReason === "no_price") return "just-added";
  if (holding.unvaluedReason === "no_quantity") return "no-position";
  return "held";
}

/**
 * Whether the value in the base currency goes under the value in the listing's own: whenever the
 * listing is valued in another currency, as "—" when the exchange rate is missing.
 */
export function showsBaseValue(holding: Holding, baseCurrency: string): boolean {
  return holding.instrument.currency !== baseCurrency && holding.value !== null;
}
