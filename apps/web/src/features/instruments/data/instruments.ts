import { z } from "zod";
import type { components } from "@/shared/api/api.types";
import { api, dataOrNull, dataOrThrow } from "@/shared/api/request";
import type { Instrument, InstrumentSearch } from "@/types/instruments";

const InstrumentIdSchema = z.uuid();

export function toInstrument(read: components["schemas"]["InstrumentRead"]): Instrument {
  return {
    id: read.id,
    type: read.type,
    name: read.name,
    symbol: read.yahoo_symbol,
    exchangeCode: read.exchange_code,
    currency: read.currency,
    isin: read.isin,
  };
}

export async function getInstrument(id: string): Promise<Instrument | null> {
  if (!InstrumentIdSchema.safeParse(id).success) return null;

  const read = await dataOrNull(
    "load the instrument",
    api.GET("/api/v1/instruments/{instrument_id}", { params: { path: { instrument_id: id } } }),
  );
  return read === null ? null : toInstrument(read);
}

export async function searchInstruments(query: string): Promise<InstrumentSearch> {
  const { items, yahoo_unavailable } = await dataOrThrow(
    "search the instruments",
    api.GET("/api/v1/instruments/search", { params: { query: { q: query } } }),
  );

  return {
    catalogue: items.flatMap((item) => (item.source === "local" ? [toInstrument(item)] : [])),
    provider: items.flatMap((item) =>
      item.source === "yahoo"
        ? [
            {
              name: item.name,
              symbol: item.yahoo_symbol,
              exchangeCode: item.exchange_code,
              type: item.type,
            },
          ]
        : [],
    ),
    providerUnavailable: yahoo_unavailable,
  };
}
