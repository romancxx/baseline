import { isSkipped, statusLabel } from "@/features/portfolio/utils/import";
import { cn } from "@/shared/ui/cn";
import type { ImportRowReport } from "@/types/portfolio";

export type ImportStatusProps = {
  readonly row: ImportRowReport;
};

export function ImportStatus({ row: { status, reason } }: ImportStatusProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "w-fit rounded-tag border px-tag-x py-tag-y font-semibold text-tag",
          isSkipped(status)
            ? "border-partial-muted bg-partial-tint text-partial"
            : "border-hairline-strong bg-surface-raised text-primary",
        )}
      >
        {statusLabel(status)}
      </span>
      {reason === null ? null : <span className="text-caption text-secondary">{reason}</span>}
    </div>
  );
}
