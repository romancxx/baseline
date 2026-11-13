import { ImportStatus } from "@/features/portfolio/components/display/import-status";
import type { ImportRowReport } from "@/types/portfolio";

export type ImportReportRowProps = {
  readonly row: ImportRowReport;
};

const NONE = "—";

/** Renders its own `<tr>`. */
export function ImportReportRow({ row }: ImportReportRowProps) {
  return (
    <tr className="border-hairline border-b align-top">
      <td className="px-3 py-3 font-mono text-caption text-tertiary">{row.line}</td>
      <td className="px-3 py-3 font-mono text-caption">{row.isin ?? NONE}</td>
      <td className="px-3 py-3">
        <ImportStatus row={row} />
      </td>
      <td className="px-3 py-3 font-mono text-caption">{row.symbol ?? NONE}</td>
      <td className="px-3 py-3">
        {row.alternatives.length === 0 ? (
          <span className="text-tertiary">{NONE}</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {row.alternatives.map((symbol) => (
              <li
                key={symbol}
                className="rounded-tag border border-hairline px-tag-x py-tag-y font-mono text-meta text-secondary"
              >
                {symbol}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
