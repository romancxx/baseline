import type { Instrument } from "@/features/instruments";
import { AddWatchlistForm } from "@/features/portfolio/components/form/add-watchlist-form";
import { WatchlistRow } from "@/features/portfolio/components/row/watchlist-row";
import type { WatchlistItem } from "@/features/portfolio/schemas/portfolio.schema";

export type WatchlistSectionProps = {
  readonly items: readonly WatchlistItem[];
  readonly instruments: readonly Instrument[];
};

export function WatchlistSection({ items, instruments }: WatchlistSectionProps) {
  return (
    <section className="flex flex-col gap-stack rounded-card border border-hairline bg-surface p-card">
      <header>
        <h2 className="text-heading">Watchlist</h2>
        <p className="mt-1 text-detail text-secondary">Not owned, still worth knowing about.</p>
      </header>

      <AddWatchlistForm
        instruments={instruments}
        watchedInstrumentIds={items.map((item) => item.instrument.id)}
      />

      {items.length === 0 ? (
        <p className="text-secondary">Nothing on the watchlist.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <WatchlistRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
