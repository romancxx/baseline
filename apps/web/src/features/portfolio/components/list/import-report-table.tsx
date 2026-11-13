import { ImportReportRow } from "@/features/portfolio/components/row/import-report-row";
import type { ImportRowReport } from "@/types/portfolio";

export type ImportReportTableProps = {
  readonly rows: readonly ImportRowReport[];
};

const COLUMNS = ["Line", "ISIN", "Status", "Listing", "Other listings"] as const;

export function ImportReportTable({ rows }: ImportReportTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-hairline border-dashed px-card py-10 text-center text-detail text-secondary">
        The file has no rows to import.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr className="border-hairline-strong border-b">
          {COLUMNS.map((label) => (
            <th
              key={label}
              scope="col"
              className="whitespace-nowrap px-3 pb-2 text-left text-overline text-tertiary uppercase"
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ImportReportRow key={row.line} row={row} />
        ))}
      </tbody>
    </table>
  );
}
