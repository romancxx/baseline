import { FeedCard } from "@/features/news/components/card/feed-card";
import type { FeedItem, ReviewFilter } from "@/features/news/schemas/feed.schema";

export type NewsFeedProps = {
  readonly items: readonly FeedItem[];
  readonly filter: ReviewFilter;
  /** False when the user holds and watches nothing, which is a different empty state. */
  readonly hasInstruments: boolean;
};

const FILTER_RELATION = { portfolio: "holding", watchlist: "watchlist" } as const;

function matches(item: FeedItem, filter: ReviewFilter): boolean {
  return (
    filter === "all" || item.instruments.some((entry) => entry.relation === FILTER_RELATION[filter])
  );
}

function emptyMessage(filter: ReviewFilter, hasInstruments: boolean): string {
  if (!hasInstruments) {
    return "Add a position or something to watch, and its news will appear here.";
  }
  if (filter !== "all") {
    return `Nothing published for your ${filter} yet.`;
  }
  return "Nothing published for your instruments yet. The feed fills after the nightly run.";
}

export function NewsFeed({ items, filter, hasInstruments }: NewsFeedProps) {
  const shown = items.filter((item) => matches(item, filter));

  if (shown.length === 0) {
    return (
      <p className="rounded-card bg-surface p-card text-detail text-secondary">
        {emptyMessage(filter, hasInstruments)}
      </p>
    );
  }

  return (
    <ul className="grid gap-stack xl:grid-cols-2">
      {shown.map((item) => (
        <li key={item.id} className="grid">
          <FeedCard item={item} />
        </li>
      ))}
    </ul>
  );
}
