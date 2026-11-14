import { ImportReportTable } from "@/features/portfolio/components/list/import-report-table";
import {
  confirmLabel,
  importCounts,
  previewLede,
  previewSummary,
  skippedCount,
} from "@/features/portfolio/utils/import";
import { Notice } from "@/shared/ui/display/notice";
import { Button } from "@/shared/ui/form/button";
import type { ImportDryRun, ImportFailure } from "@/types/portfolio";

export type ImportPreviewProps = {
  readonly preview: ImportDryRun;
  readonly failure: ImportFailure | null;
  readonly confirming: boolean;
  readonly onConfirm: () => void;
  readonly onReset: () => void;
};

export function ImportPreview({
  preview: { file, report },
  failure,
  confirming,
  onConfirm,
  onReset,
}: ImportPreviewProps) {
  const counts = importCounts(report.rows);
  const summary = previewSummary(counts);
  const confirm = confirmLabel(counts);

  return (
    <section aria-label="Preview" className="flex flex-col gap-stack">
      <p className="font-mono text-caption text-tertiary">
        {previewLede(file.name, report.rows.length)}
      </p>
      {report.rows.length === 0 ? null : (
        <Notice tone={skippedCount(counts) > 0 ? "partial" : "success"} title={summary.title}>
          {summary.detail}
        </Notice>
      )}
      <ImportReportTable rows={report.rows} />
      {failure === null ? null : (
        <Notice tone="error" title={failure.title}>
          {failure.message}
        </Notice>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onReset} disabled={confirming}>
          Choose a different file
        </Button>
        {confirm === null ? null : (
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? "Importing…" : confirm}
          </Button>
        )}
      </div>
    </section>
  );
}
