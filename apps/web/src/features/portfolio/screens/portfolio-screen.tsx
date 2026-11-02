import { listInstruments } from "@/features/instruments/server";
import { PortfolioSection } from "@/features/portfolio/components/section/portfolio-section";
import { listPositions } from "@/features/portfolio/data/portfolio-queries";

export async function PortfolioScreen() {
  const [instruments, positions] = await Promise.all([listInstruments(), listPositions()]);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-section px-gutter py-page">
      <header>
        <h1 className="text-title">Your universe</h1>
        <p className="mt-1 text-secondary">What you hold.</p>
      </header>

      <PortfolioSection positions={positions} instruments={instruments} />
    </div>
  );
}
