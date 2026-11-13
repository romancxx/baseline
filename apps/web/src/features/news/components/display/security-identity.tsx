import Link from "next/link";
import { InstrumentAvatar, InstrumentTypeTag } from "@/features/instruments";
import { instrumentRoute } from "@/shared/routes";
import type { SecurityBrief } from "@/types/news";

export type SecurityIdentityProps = {
  readonly security: SecurityBrief;
};

export function SecurityIdentity({ security: { name, listings } }: SecurityIdentityProps) {
  const [listing] = listings;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <InstrumentAvatar instrument={listing} />
      <Link
        href={instrumentRoute(listing.id)}
        className="truncate font-semibold text-heading text-primary hover:underline"
      >
        {name}
      </Link>
      <span className="font-mono text-caption text-tertiary">{listing.symbol}</span>
      <span className="text-caption text-tertiary">{listing.exchangeCode}</span>
      <InstrumentTypeTag type={listing.type} />
    </div>
  );
}
