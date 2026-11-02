import { ReviewLayout } from "@/features/news/components/layout/review-layout";
import { listFeed } from "@/features/news/data/feed-queries";
import { listPositions } from "@/features/portfolio/server";

export async function ReviewScreen() {
  const positions = await listPositions();
  const instruments = positions.map((position) => position.instrument);
  const items = await listFeed({ instruments });

  return <ReviewLayout date={new Date()} items={items} instruments={instruments} />;
}
