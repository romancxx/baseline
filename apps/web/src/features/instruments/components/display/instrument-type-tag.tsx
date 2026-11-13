import { INSTRUMENT_TYPE_LABELS } from "@/features/instruments/utils/search";
import type { InstrumentType } from "@/types/instruments";

export type InstrumentTypeTagProps = {
  readonly type: InstrumentType;
};

export function InstrumentTypeTag({ type }: InstrumentTypeTagProps) {
  return (
    <span className="rounded-tag border border-hairline-strong bg-surface-raised px-1.5 font-mono text-meta text-tertiary uppercase">
      {INSTRUMENT_TYPE_LABELS[type]}
    </span>
  );
}
