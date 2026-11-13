import { IMPORT_MAX_FILE_BYTES } from "@/features/portfolio/schemas/import.schema";
import type {
  ImportCounts,
  ImportFailure,
  ImportRowReport,
  ImportStatus,
  ImportStatusText,
  ImportStep,
  ImportStepEntry,
  ImportSummary,
} from "@/types/portfolio";

const STATUSES = {
  imported: { label: "Will import", done: "imported", saved: true },
  updated: { label: "Will update", done: "updated", saved: true },
  not_found: { label: "Not found", done: "not found", saved: false },
  invalid: { label: "Invalid", done: "invalid", saved: false },
  currency_mismatch: { label: "Currency mismatch", done: "currency mismatch", saved: false },
} as const satisfies Record<ImportStatus, ImportStatusText>;

function isImportStatus(key: string): key is ImportStatus {
  return Object.hasOwn(STATUSES, key);
}

/** The statuses in the table's order. */
const STATUS_ORDER: readonly ImportStatus[] = Object.keys(STATUSES).filter(isImportStatus);

const BYTES_PER_KB = 1024;

const IMPORT_STEPS = [
  { step: "upload", label: "Upload" },
  { step: "preview", label: "Preview" },
  { step: "confirm", label: "Confirm" },
] as const satisfies readonly Omit<ImportStepEntry, "state">[];

/** The CSV's header and three rows, as screen 07 shows them. */
export const FORMAT_EXAMPLE = {
  header: "isin,quantity,average_price,currency",
  rows: "FR0000121014,4,612.30,EUR\nIE00B4L5Y983,25,98.10,EUR\nUS67066G1040,6,164.20,USD",
} as const;

/** Pasted with a broker's export into an AI tool, to get the CSV's format. */
export const CONVERSION_PROMPT =
  "Convert this broker export to a CSV with exactly these columns: isin,quantity,average_price,currency. One row per position. Use the ISIN, not the ticker. Leave a cell empty if the value is missing. No other columns, no totals row.";

export function statusLabel(status: ImportStatus): string {
  return STATUSES[status].label;
}

export function isSkipped(status: ImportStatus): boolean {
  return !STATUSES[status].saved;
}

export function importCounts(rows: readonly ImportRowReport[]): ImportCounts {
  const counts = { imported: 0, updated: 0, not_found: 0, invalid: 0, currency_mismatch: 0 };
  for (const { status } of rows) counts[status] += 1;
  return counts;
}

function countWhere(counts: ImportCounts, saved: boolean): number {
  return STATUS_ORDER.filter((status) => STATUSES[status].saved === saved).reduce(
    (sum, status) => sum + counts[status],
    0,
  );
}

export function skippedCount(counts: ImportCounts): number {
  return countWhere(counts, false);
}

function savedCount(counts: ImportCounts): number {
  return countWhere(counts, true);
}

/** Each step of the import, marked done, current or next against the current one. */
export function importSteps(current: ImportStep): readonly ImportStepEntry[] {
  const currentIndex = IMPORT_STEPS.findIndex(({ step }) => step === current);
  return IMPORT_STEPS.map((entry, index) => ({
    ...entry,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "next",
  }));
}

/** "9 will import, 2 will update, 1 will be skipped", leaving out the parts with no rows. */
export function previewSummary(counts: ImportCounts): ImportSummary {
  const skipped = skippedCount(counts);
  const parts = [
    [counts.imported, "will import"],
    [counts.updated, "will update"],
    [skipped, "will be skipped"],
  ] as const;

  return {
    title: parts
      .filter(([count]) => count > 0)
      .map(([count, words]) => `${count} ${words}`)
      .join(", "),
    detail:
      skipped > 0
        ? "Rows that will be skipped are not imported. Nothing is saved yet."
        : "Nothing is saved yet.",
  };
}

/** "9 imported, 2 updated, 1 not found", leaving out the statuses with no rows; `null` without rows. */
export function importedSummary(counts: ImportCounts): ImportSummary | null {
  if (savedCount(counts) + skippedCount(counts) === 0) return null;

  return {
    title: STATUS_ORDER.filter((status) => counts[status] > 0)
      .map((status) => `${counts[status]} ${STATUSES[status].done}`)
      .join(", "),
    detail:
      skippedCount(counts) > 0
        ? "Rows that couldn't be imported were skipped."
        : "Your holdings are up to date.",
  };
}

/** "holdings-nov.csv · 12 rows read" */
export function previewLede(fileName: string, rowCount: number): string {
  return `${fileName} · ${rowCount} ${rowCount === 1 ? "row" : "rows"} read`;
}

/** "up to 64 KB" */
export function sizeLimitText(bytes: number): string {
  return `up to ${bytes / BYTES_PER_KB} KB`;
}

/** A file over the API's limit, refused by the API or before it is sent. */
export function fileTooLarge(): ImportFailure {
  return {
    ok: false,
    title: "That file is too large",
    message: `A file can be ${sizeLimitText(IMPORT_MAX_FILE_BYTES)}. Remove some rows or split it, then upload it again.`,
  };
}

/** "Import 11 rows"; `null` when no row would be saved. */
export function confirmLabel(counts: ImportCounts): string | null {
  const saved = savedCount(counts);
  if (saved === 0) return null;
  return `Import ${saved} ${saved === 1 ? "row" : "rows"}`;
}
