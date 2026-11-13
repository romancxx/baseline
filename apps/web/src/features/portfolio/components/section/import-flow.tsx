"use client";

import { ImportSteps } from "@/features/portfolio/components/display/import-steps";
import { CsvDropZone } from "@/features/portfolio/components/input/csv-drop-zone";
import { ImportFormat } from "@/features/portfolio/components/section/import-format";
import { ImportPreview } from "@/features/portfolio/components/section/import-preview";
import { useImportFlow } from "@/features/portfolio/hooks/use-import-flow";
import { IMPORT_MAX_FILE_BYTES } from "@/features/portfolio/schemas/import.schema";
import { sizeLimitText } from "@/features/portfolio/utils/import";
import { Notice } from "@/shared/ui/display/notice";
import type { ConfirmImport, PreviewImport } from "@/types/portfolio";

export type ImportFlowProps = {
  readonly previewImport: PreviewImport;
  readonly confirmImport: ConfirmImport;
};

export function ImportFlow({ previewImport, confirmImport }: ImportFlowProps) {
  const flow = useImportFlow(previewImport, confirmImport);

  return (
    <div className="flex flex-col gap-section">
      <ImportSteps current={flow.step} />
      {flow.preview === null ? (
        <div className="grid grid-cols-5 items-start gap-section">
          <div className="col-span-3">
            <CsvDropZone
              limit={sizeLimitText(IMPORT_MAX_FILE_BYTES)}
              pending={flow.reading}
              onFile={flow.choose}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-stack">
            <ImportFormat />
            {flow.failure === null ? null : (
              <Notice tone="error" title={flow.failure.title}>
                {flow.failure.message}
              </Notice>
            )}
          </div>
        </div>
      ) : (
        <ImportPreview
          preview={flow.preview}
          failure={flow.failure}
          confirming={flow.confirming}
          onConfirm={flow.confirm}
          onReset={flow.reset}
        />
      )}
    </div>
  );
}
