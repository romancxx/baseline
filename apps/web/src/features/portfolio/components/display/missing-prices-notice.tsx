import { Notice } from "@/shared/ui/display/notice";
import type { PricedCount } from "@/types/portfolio";

export type MissingPricesNoticeProps = {
  readonly count: PricedCount;
};

export function MissingPricesNotice({ count: { priced, of } }: MissingPricesNoticeProps) {
  return (
    <Notice tone="partial" title="Some prices are missing">
      {priced} of {of} holdings are priced. Totals cover the priced ones only.
    </Notice>
  );
}
