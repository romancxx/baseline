import type { DateRange, PriceRange } from "@/types/instruments";

export const PRICE_RANGES = ["1M", "6M", "1Y", "5Y"] as const satisfies readonly PriceRange[];

export const DEFAULT_PRICE_RANGE: PriceRange = "1Y";

const MONTHS_BACK = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60 } as const;

/** The `?range=` value, or the default for a missing or unknown one. */
export function parsePriceRange(value: string | string[] | undefined): PriceRange {
  return PRICE_RANGES.find((range) => range === value) ?? DEFAULT_PRICE_RANGE;
}

/** From the same day `range` months back, clamped to that month's last day, to today, in UTC. */
export function rangeDates(range: PriceRange, today: Date): DateRange {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() - MONTHS_BACK[range];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const from = new Date(Date.UTC(year, month, Math.min(today.getUTCDate(), lastDay)));

  return { from: isoDay(from), to: isoDay(today) };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
