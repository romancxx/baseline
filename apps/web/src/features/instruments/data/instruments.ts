import type { components } from "@/shared/api/api.types";
import type { Instrument } from "@/types/instruments";

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
