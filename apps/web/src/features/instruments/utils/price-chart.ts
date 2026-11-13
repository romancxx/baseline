import type { ChartPoint, DailyClose } from "@/types/instruments";

export function chartPoints(closes: readonly DailyClose[]): ChartPoint[] {
  return closes.map(({ date, close }) => ({ date, y: Number(close) }));
}

export function closeOn(closes: readonly DailyClose[], date: unknown): DailyClose | null {
  return closes.find((close) => close.date === date) ?? null;
}
