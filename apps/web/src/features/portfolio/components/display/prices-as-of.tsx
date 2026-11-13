import { PricesAsOfStamp } from "@/features/portfolio/components/display/prices-as-of-stamp";
import { getPortfolioOverview } from "@/features/portfolio/data/portfolio-overview";

export async function PricesAsOf() {
  const { totals } = await getPortfolioOverview();
  return <PricesAsOfStamp date={totals.pricesAsOf} />;
}
