import { PriceChart } from "@/features/instruments/components/display/price-chart";
import { PriceRangeLinks } from "@/features/instruments/components/navigation/price-range-links";
import { listCloses } from "@/features/instruments/data/instruments";
import { rangeDates } from "@/features/instruments/utils/price-range";
import type { Instrument, PriceRange } from "@/types/instruments";

export type PriceChartCardProps = {
  readonly instrument: Instrument;
  readonly range: PriceRange;
};

export async function PriceChartCard({ instrument, range }: PriceChartCardProps) {
  const closes = await listCloses(instrument.id, rangeDates(range, new Date()));

  return (
    <section
      aria-label="Closing price"
      className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-card"
    >
      <div className="flex items-center gap-3">
        <h2 className="text-overline text-tertiary uppercase">Closing price</h2>
        <div className="ml-auto">
          <PriceRangeLinks instrumentId={instrument.id} active={range} />
        </div>
      </div>
      {closes.length === 0 ? (
        <p className="text-detail text-secondary">No closing prices in this range.</p>
      ) : (
        <PriceChart closes={closes} currency={instrument.currency} />
      )}
    </section>
  );
}
