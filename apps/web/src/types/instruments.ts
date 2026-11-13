import type { components } from "@/shared/api/api.types";

export type InstrumentType = components["schemas"]["InstrumentType"];

/** A listing: one exchange's quote of a security, from the API's `InstrumentRead`. */
export type Instrument = {
  readonly id: string;
  readonly type: InstrumentType;
  readonly name: string;
  /** The market data provider's symbol: "MC.PA". */
  readonly symbol: string;
  readonly exchangeCode: string;
  /** ISO 4217 code of the currency the listing is quoted in. */
  readonly currency: string;
  readonly isin: string | null;
};
