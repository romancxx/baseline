import type { components } from "@/shared/api/api.types";
import type { DecimalString } from "@/types/format";
import type { Instrument } from "@/types/instruments";

export type UnvaluedReason = components["schemas"]["UnvaluedReason"];

/** A row of the API's overview. Amounts are in the listing's currency unless named `Base`. */
export type Holding = {
  /** The API's position id. */
  readonly id: string;
  readonly instrument: Instrument;
  readonly quantity: DecimalString | null;
  readonly averagePrice: DecimalString | null;
  readonly latestClose: DecimalString | null;
  /** `YYYY-MM-DD` */
  readonly latestCloseDate: string | null;
  readonly value: DecimalString | null;
  readonly valueBase: DecimalString | null;
  readonly unrealisedGain: DecimalString | null;
  /** Percentage points, like `weight`. */
  readonly unrealisedGainPct: DecimalString | null;
  readonly weight: DecimalString | null;
  /** `null` when the holding is valued. */
  readonly unvaluedReason: UnvaluedReason | null;
};

/** Over the valued holdings, in the base currency; amounts are `null` when none is valued. */
export type PortfolioTotals = {
  readonly baseCurrency: string;
  readonly value: DecimalString | null;
  readonly unrealisedGain: DecimalString | null;
  readonly unrealisedGainPct: DecimalString | null;
  readonly valuedCount: number;
};

export type HoldingRowMode = "reading" | "editing" | "removing";

export type PricedCount = {
  readonly priced: number;
  /** Holdings with a quantity. */
  readonly of: number;
};

export type PortfolioOverview = {
  /** Largest value first, then those not valued. */
  readonly holdings: readonly Holding[];
  readonly totals: PortfolioTotals;
};
