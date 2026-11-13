import Link from "next/link";
import { InstrumentAvatar } from "@/features/instruments";
import { etfLine } from "@/features/news/utils/home";
import { instrumentRoute } from "@/shared/routes";
import { Card } from "@/shared/ui/layout/card";
import type { SecurityBrief } from "@/types/news";

export type NoBriefCardProps = {
  /** Securities whose news is collected, by name. */
  readonly waiting: readonly SecurityBrief[];
  readonly etfCount: number;
};

const CHIP =
  "inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface-raised py-1 pr-3 pl-1 text-detail";

export function NoBriefCard({ waiting, etfCount }: NoBriefCardProps) {
  return (
    <Card title="No brief yet">
      <ul className="flex flex-wrap gap-2">
        {waiting.map(({ key, name, listings: [listing] }) => (
          <li key={key}>
            <Link href={instrumentRoute(listing.id)} className={CHIP}>
              <InstrumentAvatar instrument={listing} size="sm" />
              <span className="text-primary">{name}</span>
            </Link>
          </li>
        ))}
        {etfCount > 0 ? (
          <li className="inline-flex items-center px-1 text-detail text-secondary">
            {etfLine(etfCount, waiting.length > 0)}
          </li>
        ) : null}
      </ul>
    </Card>
  );
}
