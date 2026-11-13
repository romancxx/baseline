import type { components } from "@/shared/api/api.types";
import type { ImportReport } from "@/types/portfolio";

export function toImportReport(response: components["schemas"]["ImportResponse"]): ImportReport {
  return {
    rows: response.rows.map((row) => ({
      line: row.line,
      isin: row.isin,
      status: row.status,
      symbol: row.symbol ?? null,
      alternatives: row.alternatives,
      reason: row.message ?? null,
    })),
  };
}
