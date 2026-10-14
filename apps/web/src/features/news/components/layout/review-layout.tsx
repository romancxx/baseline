import { FeedDisclaimer } from "@/features/news/components/display/feed-disclaimer";
import { CoverageList } from "@/features/news/components/list/coverage-list";
import { NewsFeed } from "@/features/news/components/list/news-feed";
import { ReviewHeader } from "@/features/news/components/section/review-header";
import type { FeedInstrument, FeedItem, ReviewFilter } from "@/features/news/schemas/feed.schema";

export type ReviewLayoutProps = {
  readonly date: Date;
  readonly items: readonly FeedItem[];
  readonly instruments: readonly FeedInstrument[];
  readonly filter: ReviewFilter;
};

export function ReviewLayout({ date, items, instruments, filter }: ReviewLayoutProps) {
  return (
    <div className="flex min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col gap-section px-gutter py-page">
        <ReviewHeader date={date} kept={items.length} filter={filter} />
        <NewsFeed items={items} filter={filter} hasInstruments={instruments.length > 0} />
      </div>
      <aside className="sticky top-0 flex h-dvh w-rail shrink-0 flex-col gap-5 overflow-y-auto border-hairline border-l px-rail-x py-page">
        <CoverageList items={items} instruments={instruments} />
        <FeedDisclaimer />
      </aside>
    </div>
  );
}
