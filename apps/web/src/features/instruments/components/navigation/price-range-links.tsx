import Link from "next/link";
import { PRICE_RANGES } from "@/features/instruments/utils/price-range";
import { priceRangeRoute } from "@/shared/routes";
import { cn } from "@/shared/ui/cn";
import type { PriceRange } from "@/types/instruments";

export type PriceRangeLinksProps = {
  readonly instrumentId: string;
  readonly active: PriceRange;
};

export function PriceRangeLinks({ instrumentId, active }: PriceRangeLinksProps) {
  return (
    <nav aria-label="Price range" className="flex gap-0.5">
      {PRICE_RANGES.map((range) => (
        <Link
          key={range}
          href={priceRangeRoute(instrumentId, range)}
          scroll={false}
          aria-current={range === active ? "true" : undefined}
          className={cn(
            "rounded-tag px-2 py-0.5 font-mono text-caption text-tertiary hover:text-primary",
            range === active && "bg-surface-high text-brand",
          )}
        >
          {range}
        </Link>
      ))}
    </nav>
  );
}
