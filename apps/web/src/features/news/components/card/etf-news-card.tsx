import { etfNewsMessage } from "@/features/news/utils/instrument-news";
import { Card } from "@/shared/ui/layout/card";

export type EtfNewsCardProps = {
  readonly held: boolean;
};

export function EtfNewsCard({ held }: EtfNewsCardProps) {
  return (
    <Card title="News">
      <p className="text-detail text-secondary">{etfNewsMessage(held)}</p>
    </Card>
  );
}
