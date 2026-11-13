import { cache } from "react";
import { toInstrument } from "@/features/instruments/server";
import { api, dataOrThrow } from "@/shared/api/request";
import type { PortfolioOverview } from "@/types/portfolio";

/** The user's holdings and totals, read once per request. */
export const getPortfolioOverview = cache(async (): Promise<PortfolioOverview> => {
  const { positions, totals } = await dataOrThrow(
    "load the portfolio",
    api.GET("/api/v1/portfolio/overview"),
  );
  const unvalued = new Map(totals.unvalued.map((entry) => [entry.position_id, entry.reason]));

  return {
    holdings: positions.map(({ position, ...figures }) => ({
      id: position.id,
      instrument: toInstrument(position.instrument),
      quantity: position.quantity,
      averagePrice: position.average_price,
      latestClose: figures.latest_close,
      latestCloseDate: figures.latest_close_date,
      value: figures.value,
      valueBase: figures.value_base,
      unrealisedGain: figures.unrealised_gain,
      unrealisedGainPct: figures.unrealised_gain_pct,
      weight: figures.weight,
      unvaluedReason: unvalued.get(position.id) ?? null,
    })),
    totals: {
      baseCurrency: totals.base_currency,
      value: totals.value_base,
      unrealisedGain: totals.unrealised_gain_base,
      unrealisedGainPct: totals.unrealised_gain_base_pct,
      valuedCount: totals.valued_positions,
      pricesAsOf: totals.prices_as_of,
    },
  };
});
