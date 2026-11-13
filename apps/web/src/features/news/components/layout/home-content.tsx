import { resolveInstrument } from "@/features/instruments/server";
import { HomeLayout } from "@/features/news/components/layout/home-layout";
import { listPortfolioBriefs } from "@/features/news/data/portfolio-briefs";
import { getPortfolioOverview } from "@/features/portfolio/server";

export async function HomeContent() {
  const [overview, briefs] = await Promise.all([getPortfolioOverview(), listPortfolioBriefs()]);
  return <HomeLayout overview={overview} briefs={briefs} resolveInstrument={resolveInstrument} />;
}
