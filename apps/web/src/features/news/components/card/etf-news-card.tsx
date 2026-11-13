import { Card } from "@/shared/ui/layout/card";

export type EtfNewsCardProps = {
  readonly held: boolean;
};

export function EtfNewsCard({ held }: EtfNewsCardProps) {
  return (
    <Card title="News">
      <p className="text-detail text-secondary">
        {held
          ? "News isn't collected for ETFs. The price and your position are kept up to date, and this fund still counts towards your totals."
          : "News isn't collected for ETFs."}
      </p>
    </Card>
  );
}
