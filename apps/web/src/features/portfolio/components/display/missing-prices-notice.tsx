import { missingPricesLine } from "@/features/portfolio/utils/holdings";
import { Notice } from "@/shared/ui/display/notice";
import type { PricedCount } from "@/types/portfolio";

export type MissingPricesNoticeProps = {
  readonly count: PricedCount;
};

export function MissingPricesNotice({ count }: MissingPricesNoticeProps) {
  return (
    <Notice tone="partial" title="Some prices are missing">
      {missingPricesLine(count)}
    </Notice>
  );
}
