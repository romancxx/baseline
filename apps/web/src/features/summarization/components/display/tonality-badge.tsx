import type { Tonality } from "@/features/summarization/schemas/summary.schema";
import { cn } from "@/shared/ui/cn";

export type TonalityBadgeProps = {
  readonly tonality: Tonality;
  /** The model's own certainty */
  readonly confidence?: number | undefined;
  /** The model that classified the article, named in the hover text */
  readonly model?: string | undefined;
};

const APPEARANCE = {
  bullish: { label: "Constructive", className: "bg-tone-positive-tint text-tone-positive" },
  bearish: { label: "Adverse", className: "bg-tone-negative-tint text-tone-negative" },
  neutral: { label: "Neutral", className: "bg-tone-neutral-tint text-tone-neutral" },
} as const;

const LOW_CONFIDENCE = 0.5;

export function TonalityBadge({ tonality, confidence, model }: TonalityBadgeProps) {
  const unsure = confidence !== undefined && confidence < LOW_CONFIDENCE;
  const { label, className } = unsure ? APPEARANCE.neutral : APPEARANCE[tonality];
  const shown = unsure ? "Unclear" : label;

  const title = [
    shown,
    model === undefined ? null : `tonality by ${model}`,
    confidence === undefined ? null : `model confidence ${Math.round(confidence * 100)}%`,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <span
      title={title}
      className={cn("inline-flex shrink-0 rounded-tag px-tag-x py-tag-y text-tag", className)}
    >
      {shown}
    </span>
  );
}
