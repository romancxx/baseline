import type { Instrument } from "@/features/instruments";
import { AddPositionForm } from "@/features/portfolio/components/form/add-position-form";
import { PositionRow } from "@/features/portfolio/components/row/position-row";
import type { Position } from "@/features/portfolio/schemas/portfolio.schema";

export type PortfolioSectionProps = {
  readonly positions: readonly Position[];
  readonly instruments: readonly Instrument[];
};

export function PortfolioSection({ positions, instruments }: PortfolioSectionProps) {
  return (
    <section className="flex flex-col gap-stack rounded-card border border-hairline bg-surface p-card">
      <header>
        <h2 className="text-heading">Portfolio</h2>
        <p className="mt-1 text-detail text-secondary">What you actually own.</p>
      </header>

      <AddPositionForm
        instruments={instruments}
        heldInstrumentIds={positions.map((position) => position.instrument.id)}
      />

      {positions.length === 0 ? (
        <p className="text-secondary">No positions yet.</p>
      ) : (
        <ul className="flex flex-col">
          {positions.map((position) => (
            <PositionRow key={position.id} position={position} />
          ))}
        </ul>
      )}
    </section>
  );
}
