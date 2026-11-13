import { InstrumentAvatar } from "@/features/instruments/components/display/instrument-avatar";
import type { SearchResult } from "@/features/instruments/schemas/security-search.schema";
import { heldLabel, resultDetails } from "@/features/instruments/utils/search";
import { cn } from "@/shared/ui/cn";

export type SearchResultRowProps = {
  readonly id: string;
  readonly result: SearchResult;
  readonly active: boolean;
  readonly onOpen: (result: SearchResult) => void;
};

export function SearchResultRow({ id, result, active, onOpen }: SearchResultRowProps) {
  const held = heldLabel(result);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles ↑↓ and ↵ for every option
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={() => onOpen(result)}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-surface-raised",
        active && "bg-surface-high hover:bg-surface-high",
      )}
    >
      <InstrumentAvatar instrument={result} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-body text-primary">{result.name}</span>
        <span className="truncate font-mono text-caption text-tertiary">
          {resultDetails(result)}
        </span>
      </span>
      {held === null ? null : (
        <span className="shrink-0 rounded-tag border border-hairline-strong px-tag-x py-tag-y text-tag text-secondary">
          {held}
        </span>
      )}
    </div>
  );
}
