import { Info } from "lucide-react";
import { Icon } from "@/shared/ui/display/icon";

export function BriefsDisclaimer() {
  return (
    <p className="flex items-center gap-2 text-caption text-tertiary">
      <Icon icon={Info} />
      Briefs describe news as reported on the date shown. They are not investment advice and do not
      predict prices.
    </p>
  );
}
