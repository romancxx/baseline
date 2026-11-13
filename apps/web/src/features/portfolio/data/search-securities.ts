import { type SecuritySearch, searchQuery } from "@/features/instruments";
import { searchInstruments } from "@/features/instruments/server";
import { getPortfolioOverview } from "@/features/portfolio/data/portfolio-overview";

const NO_RESULTS: SecuritySearch = { catalogue: [], provider: [], providerUnavailable: false };

export async function searchSecurities(input: string): Promise<SecuritySearch> {
  const query = searchQuery(input);
  if (query === null) return NO_RESULTS;

  const [found, { holdings }] = await Promise.all([
    searchInstruments(query),
    getPortfolioOverview(),
  ]);
  const heldQuantities = new Map(
    holdings.map(({ instrument, quantity }) => [instrument.id, quantity]),
  );

  return {
    catalogue: found.catalogue.map((instrument) => ({
      source: "catalogue",
      id: instrument.id,
      name: instrument.name,
      symbol: instrument.symbol,
      exchangeCode: instrument.exchangeCode,
      type: instrument.type,
      currency: instrument.currency,
      held: heldQuantities.has(instrument.id),
      heldQuantity: heldQuantities.get(instrument.id) ?? null,
    })),
    provider: found.provider.map((candidate) => ({ source: "provider", ...candidate })),
    providerUnavailable: found.providerUnavailable,
  };
}
