import { BriefCard } from "@/features/news/components/card/brief-card";
import { getLatestBrief } from "@/features/news/data/instrument-news";
import { noBriefMessage } from "@/features/news/utils/instrument-news";
import { Card } from "@/shared/ui/layout/card";
import type { Instrument } from "@/types/instruments";

export type LatestBriefSectionProps = {
  readonly instrument: Instrument;
  readonly held: boolean;
};

export async function LatestBriefSection({ instrument, held }: LatestBriefSectionProps) {
  const brief = await getLatestBrief(instrument.id);
  if (brief !== null) return <BriefCard brief={brief} />;

  return (
    <Card title="No brief yet">
      <p className="text-detail text-secondary">{noBriefMessage(instrument.name, held)}</p>
    </Card>
  );
}
