import { FeedCard } from "@/features/news/components/card/feed-card";
import type { FeedItem } from "@/features/news/schemas/feed.schema";

export type NewsFeedProps = {
  readonly items: readonly FeedItem[];
  /** False when the user holds nothing, which is a different empty state. */
  readonly hasInstruments: boolean;
};

export function NewsFeed({ items, hasInstruments }: NewsFeedProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-card bg-surface p-card text-detail text-secondary">
        {hasInstruments
          ? "Nothing published for your instruments yet. The feed fills after the nightly run."
          : "Add a position, and its news will appear here."}
      </p>
    );
  }

  return (
    <ul className="grid gap-stack xl:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="grid">
          <FeedCard item={item} />
        </li>
      ))}
    </ul>
  );
}
