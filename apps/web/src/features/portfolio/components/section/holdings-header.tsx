import { Upload } from "lucide-react";
import { ROUTES } from "@/shared/routes";
import { Icon } from "@/shared/ui/display/icon";
import { ButtonLink } from "@/shared/ui/navigation/button-link";

export type HoldingsHeaderProps = {
  readonly summary: string | null;
};

export function HoldingsHeader({ summary }: HoldingsHeaderProps) {
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
      </div>
    </header>
  );
}
