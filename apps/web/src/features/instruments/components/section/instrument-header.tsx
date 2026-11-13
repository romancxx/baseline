import { InstrumentAvatar } from "@/features/instruments/components/display/instrument-avatar";
import { instrumentDetails } from "@/features/instruments/utils/search";
import { formatDate, formatMoney } from "@/shared/format";
import type { DecimalString } from "@/types/format";
import type { Instrument } from "@/types/instruments";

export type InstrumentHeaderProps = {
  readonly instrument: Instrument;
  readonly held: boolean;
  readonly latestClose: DecimalString | null;
  /** `YYYY-MM-DD` */
  readonly latestCloseDate: string | null;
};

export function InstrumentHeader({
  instrument,
  held,
  latestClose,
  latestCloseDate,
}: InstrumentHeaderProps) {
  return (
    <header className="flex items-start gap-4">
      <InstrumentAvatar instrument={instrument} size="lg" />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-2.5 text-title">
          {instrument.name}
          {held ? (
            <span className="rounded-tag border border-hairline-strong px-tag-x py-tag-y font-normal text-secondary text-tag">
              In your holdings
            </span>
          ) : null}
        </h1>
        <p className="font-mono text-meta text-tertiary uppercase">
          {instrumentDetails(instrument)}
        </p>
        <div className="mt-2 flex items-baseline gap-2.5">
          {!held ? (
            <p className="text-detail text-secondary">Prices appear once you hold it.</p>
          ) : latestClose === null || latestCloseDate === null ? (
            <p className="text-detail text-secondary">Prices appear after the next update.</p>
          ) : (
            <>
              <span className="font-mono text-display">
                {formatMoney(latestClose, instrument.currency)}
              </span>
              <span className="font-mono text-meta text-tertiary uppercase">
                Close of{" "}
                <time dateTime={latestCloseDate}>{formatDate(latestCloseDate, "day")}</time>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
