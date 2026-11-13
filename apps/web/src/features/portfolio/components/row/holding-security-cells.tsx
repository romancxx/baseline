import { InstrumentAvatar, InstrumentTypeTag } from "@/features/instruments";
import { CELL } from "@/features/portfolio/components/list/holdings-columns";
import type { Instrument } from "@/types/instruments";

export type HoldingSecurityCellsProps = {
  readonly instrument: Instrument;
};

export function HoldingSecurityCells({ instrument }: HoldingSecurityCellsProps) {
  return (
    <>
      <td className={CELL}>
        <div className="flex min-w-0 items-center gap-2.5">
          <InstrumentAvatar instrument={instrument} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-body text-primary">{instrument.name}</span>
            <span className="font-mono text-caption text-tertiary">{instrument.symbol}</span>
          </div>
        </div>
      </td>
      <td className={CELL}>
        <div className="flex items-center gap-2">
          <span className="text-caption text-tertiary">{instrument.exchangeCode}</span>
          <InstrumentTypeTag type={instrument.type} />
        </div>
      </td>
    </>
  );
}
