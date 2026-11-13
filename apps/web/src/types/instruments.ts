import type { components } from "@/shared/api/api.types";
import type { DecimalString } from "@/types/format";

export type InstrumentType = components["schemas"]["InstrumentType"];

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

export type ProviderCandidate = {
  readonly name: string;
  readonly symbol: string;
  readonly exchangeCode: string;
  readonly type: InstrumentType;
};

export type InstrumentSearch = {
  readonly catalogue: readonly Instrument[];
  readonly provider: readonly ProviderCandidate[];
  readonly providerUnavailable: boolean;
};

export type ResolveResult =
  | { readonly ok: true; readonly instrumentId: string }
  | { readonly ok: false; readonly message: string };

export type ResolveInstrument = (symbol: string) => Promise<ResolveResult>;

export type PriceRange = "1M" | "6M" | "1Y" | "5Y";

/** Both ends included, `YYYY-MM-DD`. */
export type DateRange = {
  readonly from: string;
  readonly to: string;
};

export type DailyClose = {
  /** `YYYY-MM-DD` */
  readonly date: string;
  readonly close: DecimalString;
};

/** A close placed on the chart; `y` is the one figure the web app turns into a number. */
export type ChartPoint = {
  readonly date: string;
  readonly y: number;
};
