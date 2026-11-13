import { pricesAsOfLabel } from "@/features/portfolio/utils/holdings";

export type PricesAsOfStampProps = {
  readonly date: string | null;
};

export function PricesAsOfStamp({ date }: PricesAsOfStampProps) {
  if (date === null) return null;

  return (
    <p className="whitespace-nowrap font-mono text-meta text-tertiary uppercase">
      {pricesAsOfLabel(date)}
    </p>
  );
}
