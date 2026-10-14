import { ReviewLayout } from "@/features/news/components/layout/review-layout";
import { listFeed } from "@/features/news/data/feed-queries";
import { type FeedInstrument, ReviewFilterSchema } from "@/features/news/schemas/feed.schema";
import { listPositions, listWatchlist } from "@/features/portfolio/server";

export type ReviewScreenProps = {
  readonly searchParams: PageProps<"/">["searchParams"];
};

/** Holdings win over the watchlist when an instrument is in both. */
function feedInstruments(
  positions: Awaited<ReturnType<typeof listPositions>>,
  watchlist: Awaited<ReturnType<typeof listWatchlist>>,
): FeedInstrument[] {
  const byId = new Map<string, FeedInstrument>();

  for (const item of watchlist) {
    byId.set(item.instrument.id, { instrument: item.instrument, relation: "watchlist" });
  }
  for (const position of positions) {
    byId.set(position.instrument.id, { instrument: position.instrument, relation: "holding" });
  }

  return [...byId.values()];
}

export async function ReviewScreen({ searchParams }: ReviewScreenProps) {
  const [{ filter }, positions, watchlist] = await Promise.all([
    searchParams,
    listPositions(),
    listWatchlist(),
  ]);
  const instruments = feedInstruments(positions, watchlist);
  const items = await listFeed({ instruments });

  return (
    <ReviewLayout
      date={new Date()}
      items={items}
      instruments={instruments}
      filter={ReviewFilterSchema.parse(filter)}
    />
  );
}
