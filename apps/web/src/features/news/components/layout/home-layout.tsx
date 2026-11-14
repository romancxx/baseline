import { BriefsDisclaimer } from "@/features/news/components/display/briefs-disclaimer";
import { HomeBriefsSection } from "@/features/news/components/section/home-briefs-section";
import { OverviewTiles } from "@/features/news/components/section/overview-tiles";
import { briefGroups } from "@/features/news/utils/home";
import {
  EmptyPortfolio,
  MissingPricesNotice,
  pricedCount,
  TopHoldingsCard,
} from "@/features/portfolio";
import type { ResolveInstrument } from "@/types/instruments";
import type { SecurityBrief } from "@/types/news";
import type { PortfolioOverview } from "@/types/portfolio";

export type HomeLayoutProps = {
  readonly overview: PortfolioOverview;
  /** In the API's order: newest brief first, then those without one by name. */
  readonly briefs: readonly SecurityBrief[];
  readonly resolveInstrument: ResolveInstrument;
};

export function HomeLayout({ overview, briefs, resolveInstrument }: HomeLayoutProps) {
  const priced = pricedCount(overview);
  const groups = briefGroups(briefs);

  if (overview.holdings.length === 0) {
    return (
      <div className="px-gutter py-page">
        <h1 className="sr-only">Home</h1>
        <EmptyPortfolio resolveInstrument={resolveInstrument} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <h1 className="sr-only">Home</h1>
      {priced === null ? null : <MissingPricesNotice count={priced} />}
      <OverviewTiles overview={overview} priced={priced} briefed={groups.briefed} />
      <BriefsDisclaimer />
      <div className="flex items-start gap-section">
        <HomeBriefsSection groups={groups} />
        <aside className="flex w-rail shrink-0 flex-col gap-stack">
          <TopHoldingsCard overview={overview} />
        </aside>
      </div>
    </div>
  );
}
