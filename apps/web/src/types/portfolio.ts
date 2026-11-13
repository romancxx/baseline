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
  /** `YYYY-MM-DD`, the latest close among the valued holdings; `null` when none is valued. */
  readonly pricesAsOf: string | null;
};

export type HoldingMode = "reading" | "editing" | "removing";

/** `just-added`: held, but no close has been fetched yet. */
export type HoldingStatus = "not-held" | "just-added" | "no-position" | "held";

export type PricedCount = {
  readonly priced: number;
  /** Holdings with a quantity. */
  readonly of: number;
};

export type ImportStatus = components["schemas"]["ImportStatus"];

/** The import's multipart body. */
export type ImportUpload = components["schemas"]["Body_import_csv_api_v1_portfolio_import_post"];

/** What the import did, or would do in a dry run, with one line of the CSV. */
export type ImportRowReport = {
  /** The line in the file; the header is line 1. */
  readonly line: number;
  /** As written in the file; `null` when the row has no cell for it. */
  readonly isin: string | null;
  readonly status: ImportStatus;
  /** The matched listing's symbol; `null` when none was matched. */
  readonly symbol: string | null;
  /** Up to three other listings of the security, by symbol. */
  readonly alternatives: readonly string[];
  /** Why the row is skipped; `null` for a row that is saved. */
  readonly reason: string | null;
};

export type ImportReport = {
  readonly rows: readonly ImportRowReport[];
};

/** Rows by status. */
export type ImportCounts = Readonly<Record<ImportStatus, number>>;

/** A notice's title and the line under it. */
export type ImportSummary = {
  readonly title: string;
  readonly detail: string;
};

/** Why the file was refused before any row was read. */
export type ImportFailure = {
  readonly ok: false;
  readonly title: string;
  readonly message: string;
};

export type ImportPreviewResult =
  | { readonly ok: true; readonly report: ImportReport }
  | ImportFailure;

/** Sends the CSV in `file` as a dry run. */
export type PreviewImport = (formData: FormData) => Promise<ImportPreviewResult>;

/** Imports the CSV in `file`, then redirects to Holdings; `undefined` once it has redirected. */
export type ConfirmImport = (formData: FormData) => Promise<ImportFailure | undefined>;

/** How a status reads, and whether its row is saved or skipped. */
export type ImportStatusText = {
  /** In the preview: "Will import". */
  readonly label: string;
  /** After the import: "imported". */
  readonly done: string;
  readonly saved: boolean;
};

export type ImportStep = "upload" | "preview" | "confirm";

export type ImportStepEntry = {
  readonly step: ImportStep;
  readonly label: string;
  readonly state: "done" | "current" | "next";
};

/** A dry run's report, with the file it read, to be sent again by the confirm. */
export type ImportPreview = {
  readonly file: File;
  readonly report: ImportReport;
};

export type ImportFlow = {
  readonly step: ImportStep;
  /** `null` until a file is previewed. */
  readonly preview: ImportPreview | null;
  /** Why the last upload or confirm failed; `null` otherwise. */
  readonly failure: ImportFailure | null;
  /** The dry run is in flight. */
  readonly reading: boolean;
  /** The import is in flight. */
  readonly confirming: boolean;
  readonly choose: (file: File) => void;
  readonly confirm: () => void;
  /** Back to the upload, forgetting the file and its report. */
  readonly reset: () => void;
};

export type PortfolioOverview = {
  /** Largest value first, then those not valued. */
  readonly holdings: readonly Holding[];
  readonly totals: PortfolioTotals;
};
