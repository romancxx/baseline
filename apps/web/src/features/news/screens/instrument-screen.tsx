import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InstrumentHeader, parsePriceRange } from "@/features/instruments";
import { getInstrument, PriceChartCard } from "@/features/instruments/server";
import { EtfNewsCard } from "@/features/news/components/card/etf-news-card";
import { InstrumentNewsSection } from "@/features/news/components/section/instrument-news-section";
import { LatestBriefSection } from "@/features/news/components/section/latest-brief-section";
import { findHolding, PositionCard } from "@/features/portfolio";
import {
  addPosition,
  editPosition,
  getPortfolioOverview,
  removePosition,
} from "@/features/portfolio/server";
import { Skeleton } from "@/shared/ui/display/skeleton";
import { Card } from "@/shared/ui/layout/card";

export type InstrumentScreenProps = {
  readonly params: PageProps<"/instruments/[id]">["params"];
  readonly searchParams: PageProps<"/instruments/[id]">["searchParams"];
};

export async function InstrumentScreen({ params, searchParams }: InstrumentScreenProps) {
  const [{ id }, { range }] = await Promise.all([params, searchParams]);
  const [instrument, overview] = await Promise.all([getInstrument(id), getPortfolioOverview()]);
  if (instrument === null) notFound();

  const holding = findHolding(overview, instrument.id);
  const held = holding !== null;

  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <InstrumentHeader
        instrument={instrument}
        held={held}
        latestClose={holding?.latestClose ?? null}
        latestCloseDate={holding?.latestCloseDate ?? null}
      />
      <div className="flex items-start gap-section">
        <div className="flex min-w-0 flex-1 flex-col gap-stack">
          {holding !== null && holding.latestClose !== null ? (
            <Suspense
              fallback={
                <Card title="Closing price">
                  <Skeleton className="h-chart w-full" />
                </Card>
              }
            >
              <PriceChartCard instrument={instrument} range={parsePriceRange(range)} />
            </Suspense>
          ) : null}
          <Suspense
            fallback={
              <Card title="Latest brief">
                <Skeleton className="h-placeholder w-full" />
              </Card>
            }
          >
            <LatestBriefSection instrument={instrument} held={held} />
          </Suspense>
          {instrument.type === "etf" ? (
            <EtfNewsCard held={held} />
          ) : (
            <Suspense
              fallback={
                <Card title="News">
                  <Skeleton className="h-placeholder w-full" />
                </Card>
              }
            >
              <InstrumentNewsSection instrument={instrument} />
            </Suspense>
          )}
        </div>
        <aside className="flex w-rail shrink-0 flex-col gap-stack">
          <PositionCard
            instrument={instrument}
            holding={holding}
            baseCurrency={overview.totals.baseCurrency}
            addPosition={addPosition}
            editPosition={editPosition}
            removePosition={removePosition}
          />
        </aside>
      </div>
    </div>
  );
}
