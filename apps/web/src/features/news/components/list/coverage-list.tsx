import type { Instrument } from "@/features/instruments";
import { CoverageRow } from "@/features/news/components/row/coverage-row";
import type { FeedItem } from "@/features/news/schemas/feed.schema";

export type CoverageListProps = {
  readonly items: readonly FeedItem[];
  readonly instruments: readonly Instrument[];
};

/** Articles per instrument id, in order of each instrument's most recent article. */
function countArticles(items: readonly FeedItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const instrument of item.instruments) {
      counts.set(instrument.id, (counts.get(instrument.id) ?? 0) + 1);
    }
  }
  return counts;
}

export function CoverageList({ items, instruments }: CoverageListProps) {
  const counts = countArticles(items);
  const byId = new Map(instruments.map((instrument) => [instrument.id, instrument] as const));

  const covered = [...counts.keys()].flatMap((id) => byId.get(id) ?? []);
  const missing = instruments.filter((instrument) => !counts.has(instrument.id));

  return (
    <>
      {covered.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-overline text-tertiary uppercase">Covered</h2>
          <ul>
            {covered.map((instrument) => (
              <CoverageRow
                key={instrument.id}
                instrument={instrument}
                count={counts.get(instrument.id) ?? 0}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {missing.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-overline text-tertiary uppercase">No news</h2>
          <ul>
            {missing.map((instrument) => (
              <CoverageRow key={instrument.id} instrument={instrument} count={0} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
