import { Upload } from "lucide-react";
import { AddSecurityButton } from "@/features/instruments";
import { ROUTES } from "@/shared/routes";
import { Icon } from "@/shared/ui/display/icon";
import { ButtonLink } from "@/shared/ui/navigation/button-link";
import type { ResolveInstrument } from "@/types/instruments";

export type HoldingsHeaderProps = {
  readonly summary: string | null;
  readonly resolveInstrument: ResolveInstrument;
};

export function HoldingsHeader({ summary, resolveInstrument }: HoldingsHeaderProps) {
  return (
    <header className="flex items-end gap-4">
      <div>
        <h1 className="text-title">Holdings</h1>
        {summary === null ? null : <p className="mt-1 text-detail text-secondary">{summary}</p>}
      </div>
      <div className="ml-auto flex gap-2">
        <ButtonLink href={ROUTES.holdingsImport} variant="secondary">
          <Icon icon={Upload} />
          Import CSV
        </ButtonLink>
        <AddSecurityButton label="Add a security" resolveInstrument={resolveInstrument} />
      </div>
    </header>
  );
}
