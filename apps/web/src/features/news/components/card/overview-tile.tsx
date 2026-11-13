import type { ReactNode } from "react";

export type OverviewTileProps = {
  readonly label: string;
  /** The figure, or its placeholder while loading. */
  readonly value: ReactNode;
  /** The line under the figure, in upper case. */
  readonly meta: ReactNode;
};

export function OverviewTile({ label, value, meta }: OverviewTileProps) {
  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-1.5 rounded-card border border-hairline bg-surface p-card"
    >
      <h2 className="text-overline text-tertiary uppercase">{label}</h2>
      <div className="font-mono text-display text-primary tabular-nums">{value}</div>
      <div className="flex flex-wrap gap-x-1.5 font-mono text-meta text-tertiary uppercase">
        {meta}
      </div>
    </section>
  );
}
