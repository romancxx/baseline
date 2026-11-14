import { OverviewTile } from "@/features/news/components/card/overview-tile";
import { BriefsDisclaimer } from "@/features/news/components/display/briefs-disclaimer";
import { HoldingPlaceholderRow } from "@/features/news/components/row/holding-placeholder-row";
import { Skeleton } from "@/shared/ui/display/skeleton";
import { Card } from "@/shared/ui/layout/card";

const TILES = ["Total value", "Unrealised gain", "Briefs"] as const;

export function HomeSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-section px-gutter py-page">
      <h1 className="sr-only">Home</h1>
      <div className="grid grid-cols-3 gap-stack">
        {TILES.map((label) => (
          <OverviewTile
            key={label}
            label={label}
            value={<Skeleton className="h-lh w-1/2" />}
            meta={<Skeleton className="h-lh w-2/3" />}
          />
        ))}
      </div>
      <BriefsDisclaimer />
      <div className="flex items-start gap-section">
        <div className="flex min-w-0 flex-1 flex-col gap-stack">
          <h2 className="text-title">Latest briefs</h2>
          <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-card">
            <div className="flex items-center gap-2.5 text-heading">
              <Skeleton className="size-avatar rounded-avatar" />
              <Skeleton className="h-lh w-1/3" />
              <Skeleton className="ml-auto h-lh w-1/6 rounded-pill" />
            </div>
            <div className="max-w-prose text-brief">
              <Skeleton className="h-lh w-full" />
              <Skeleton className="mt-1 h-lh w-full" />
              <Skeleton className="mt-1 h-lh w-2/3" />
            </div>
          </div>
        </div>
        <aside className="flex w-rail shrink-0 flex-col gap-stack">
          <Card title="Holdings">
            <ul className="flex flex-col divide-y divide-hairline">
              <HoldingPlaceholderRow />
              <HoldingPlaceholderRow />
              <HoldingPlaceholderRow />
              <HoldingPlaceholderRow />
              <HoldingPlaceholderRow />
            </ul>
            <Skeleton className="mt-3 min-h-button-sm w-1/3 rounded-control" />
          </Card>
        </aside>
      </div>
    </div>
  );
}
