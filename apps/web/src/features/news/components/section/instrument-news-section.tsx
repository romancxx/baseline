import { loadMoreNews } from "@/features/news/actions/load-more-news";
import { InstrumentNewsList } from "@/features/news/components/list/instrument-news-list";
import { listNews } from "@/features/news/data/instrument-news";
import { Card } from "@/shared/ui/layout/card";
import type { Instrument } from "@/types/instruments";

export type InstrumentNewsSectionProps = {
  readonly instrument: Instrument;
};

export async function InstrumentNewsSection({ instrument }: InstrumentNewsSectionProps) {
  const firstPage = await listNews(instrument.id);

  return (
    <Card title="News">
      <InstrumentNewsList
        instrumentId={instrument.id}
        firstPage={firstPage}
        loadMoreNews={loadMoreNews}
      />
    </Card>
  );
}
