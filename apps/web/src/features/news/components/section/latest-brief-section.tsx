import { BriefCard } from "@/features/news/components/card/brief-card";
import { getLatestBrief } from "@/features/news/data/instrument-news";
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
      <p className="text-detail text-secondary">
        {held
          ? `Nothing has been reported on ${instrument.name} in the window covered by the last update. The next brief arrives after the next one.`
          : `Briefs and prices are only collected for securities you hold. Add ${instrument.name} and the first of each arrives after the next update.`}
      </p>
    </Card>
  );
}
