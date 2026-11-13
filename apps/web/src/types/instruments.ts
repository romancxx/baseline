import type { components } from "@/shared/api/api.types";

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
