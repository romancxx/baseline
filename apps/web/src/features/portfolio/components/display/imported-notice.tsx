import { Notice } from "@/shared/ui/display/notice";
import type { ImportSummary } from "@/types/portfolio";

export type ImportedNoticeProps = {
  readonly summary: ImportSummary;
};

export function ImportedNotice({ summary: { title, detail } }: ImportedNoticeProps) {
  return (
    <Notice tone="success" title={title}>
      {detail}
    </Notice>
  );
}
