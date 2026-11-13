import { Upload } from "lucide-react";
import { AddSecurityButton } from "@/features/instruments";
import { ROUTES } from "@/shared/routes";
import { Icon } from "@/shared/ui/display/icon";
import { ButtonLink } from "@/shared/ui/navigation/button-link";
import type { ResolveInstrument } from "@/types/instruments";

export type EmptyPortfolioProps = {
  readonly resolveInstrument: ResolveInstrument;
};

export function EmptyPortfolio({ resolveInstrument }: EmptyPortfolioProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-hairline border-dashed px-card py-10 text-center">
      <h2 className="font-serif text-headline">Nothing here yet</h2>
      <p className="max-w-prose text-detail text-secondary">
        Add what you hold and the first briefs arrive after the next update. A quantity is optional
        — you can track a security without one.
      </p>
      <div className="mt-3 flex gap-2">
        <AddSecurityButton label="Search for a security" resolveInstrument={resolveInstrument} />
        <ButtonLink href={ROUTES.holdingsImport} variant="secondary">
          <Icon icon={Upload} />
          Import a CSV
        </ButtonLink>
      </div>
    </div>
  );
}
