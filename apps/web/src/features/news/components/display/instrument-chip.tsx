import type { FeedInstrument } from "@/features/news/schemas/feed.schema";
import { cn } from "@/shared/ui/cn";

export type InstrumentChipProps = {
  readonly entry: FeedInstrument;
};

const RELATION = {
  holding: { className: "border-transparent bg-surface-raised text-primary", suffix: "" },
  watchlist: { className: "border-hairline text-secondary", suffix: " · watching" },
} as const;

export function InstrumentChip({ entry }: InstrumentChipProps) {
  const { className, suffix } = RELATION[entry.relation];

  return (
    <span className={cn("rounded-tag border px-tag-x py-tag-y text-tag", className)}>
      {entry.instrument.ticker}
      {suffix}
    </span>
  );
}
