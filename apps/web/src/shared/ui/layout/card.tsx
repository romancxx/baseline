import type { ReactNode } from "react";

export type CardProps = {
  /** Heads the card as a `<section>`; without it the card is a plain panel. */
  readonly title?: string | undefined;
  readonly children: ReactNode;
};

const SURFACE = "rounded-card border border-hairline bg-surface p-card";

export function Card({ title, children }: CardProps) {
  if (title === undefined) return <div className={SURFACE}>{children}</div>;

  return (
    <section className={SURFACE}>
      <h2 className="mb-3 flex items-center gap-2 text-overline text-tertiary uppercase">
        {title}
        <span aria-hidden="true" className="flex-1 border-hairline border-t" />
      </h2>
      {children}
    </section>
  );
}
