import { Check } from "lucide-react";
import { importSteps } from "@/features/portfolio/utils/import";
import { cn } from "@/shared/ui/cn";
import { Icon } from "@/shared/ui/display/icon";
import type { ImportStep } from "@/types/portfolio";

export type ImportStepsProps = {
  readonly current: ImportStep;
};

const STATES = {
  done: { mark: "border-hairline-strong text-secondary", label: "text-secondary" },
  current: { mark: "border-transparent bg-inverse text-inverse", label: "text-primary" },
  next: { mark: "border-hairline-strong text-tertiary", label: "text-tertiary" },
} as const;

export function ImportSteps({ current }: ImportStepsProps) {
  return (
    <ol aria-label="Import steps" className="flex items-center gap-3 text-label">
      {importSteps(current).map(({ step, label, state }, index) => (
        <li
          key={step}
          aria-current={state === "current" ? "step" : undefined}
          className="flex items-center gap-3"
        >
          {index > 0 ? (
            <span aria-hidden="true" className="w-8 border-hairline-strong border-t" />
          ) : null}
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-avatar-sm items-center justify-center rounded-pill border font-mono text-caption",
                STATES[state].mark,
              )}
            >
              {state === "done" ? <Icon icon={Check} /> : index + 1}
            </span>
            <span className={cn("font-semibold", STATES[state].label)}>{label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
