import type { Position } from "@/features/portfolio/schemas/portfolio.schema";

export type PortfolioSectionProps = {
  readonly positions: readonly Position[];
};

export function PortfolioSection({ positions }: PortfolioSectionProps) {
  return (
    <section className="flex flex-col gap-stack rounded-card border border-hairline bg-surface p-card">
      <header>
        <h2 className="text-heading">Portfolio</h2>
        <p className="mt-1 text-detail text-secondary">What you actually own.</p>
      </header>

      {positions.length === 0 ? (
        <p className="text-secondary">No positions yet.</p>
      ) : (
        <ul className="flex flex-col">
          {positions.map((position) => (
            <li key={position.id} className="border-hairline border-b py-3 last:border-b-0">
              <p className="font-semibold">
                {position.instrument.ticker}{" "}
                <span className="font-normal text-secondary">{position.instrument.name}</span>
              </p>
              <p className="mt-1 text-detail text-secondary">
                {position.quantity} units
                {position.costBasis === null ? "" : ` · cost basis ${position.costBasis}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
