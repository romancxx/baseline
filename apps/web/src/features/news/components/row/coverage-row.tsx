import { InstrumentAvatar } from "@/features/instruments";
import type { FeedInstrument } from "@/features/news/schemas/feed.schema";
import { cn } from "@/shared/ui/cn";

export type CoverageRowProps = {
  readonly instrument: FeedInstrument;
  readonly count: number;
};

export function CoverageRow({ instrument, count }: CoverageRowProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-hairline border-b py-3",
        count === 0 && "opacity-dimmed",
      )}
    >
      <InstrumentAvatar instrument={instrument} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-caption text-primary">
          {instrument.symbol}
        </span>
        <span className="text-caption text-tertiary">
          {count === 0 ? "—" : `${count} ${count === 1 ? "article" : "articles"}`}
        </span>
      </div>
    </li>
  );
}
