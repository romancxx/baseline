import { ArticleFeedCard } from "@/features/news/components/card/article-feed-card";
import type { FeedItem } from "@/features/news/schemas/feed.schema";

export type FeedCardProps = {
  readonly item: FeedItem;
};

/** Dispatches on `item.kind`; a new kind is a new union member and a renderer here. */
export function FeedCard({ item }: FeedCardProps) {
  switch (item.kind) {
    case "article":
      return <ArticleFeedCard item={item} />;
  }
}
