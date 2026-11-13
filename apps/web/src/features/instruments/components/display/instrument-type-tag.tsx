import type { InstrumentType } from "@/types/instruments";

export type InstrumentTypeTagProps = {
  readonly type: InstrumentType;
};

const LABELS = { stock: "Stock", etf: "ETF" } as const;

export function InstrumentTypeTag({ type }: InstrumentTypeTagProps) {
  return (
    <span className="rounded-tag border border-hairline-strong bg-surface-raised px-1.5 font-mono text-meta text-tertiary uppercase">
      {LABELS[type]}
    </span>
  );
}
