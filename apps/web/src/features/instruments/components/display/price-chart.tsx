"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PriceTooltip } from "@/features/instruments/components/display/price-tooltip";
import { chartPoints } from "@/features/instruments/utils/price-chart";
import { formatDate } from "@/shared/format";
import type { DailyClose } from "@/types/instruments";

export type PriceChartProps = {
  readonly closes: readonly DailyClose[];
  readonly currency: string;
};

/** Theme colours, read by the SVG Recharts draws. */
const COLORS = {
  line: "var(--text-color-primary)",
  grid: "var(--border-color-hairline)",
  axis: "var(--text-color-tertiary)",
  cursor: "var(--border-color-hairline-strong)",
} as const;

const FILL_OPACITY = { top: 0.16, bottom: 0 } as const;
const MARGIN_PX = { top: 4, right: 0, bottom: 0, left: 0 } as const;
const MIN_TICK_GAP_PX = 48;
const LINE_WIDTH_PX = 2;
const DOT_RADIUS_PX = 4;

export function PriceChart({ closes, currency }: PriceChartProps) {
  const fillId = useId();

  return (
    <div className="h-chart font-mono text-meta">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartPoints(closes)} margin={MARGIN_PX}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.line} stopOpacity={FILL_OPACITY.top} />
              <stop offset="100%" stopColor={COLORS.line} stopOpacity={FILL_OPACITY.bottom} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => formatDate(date, "monthYear")}
            tick={{ fill: COLORS.axis }}
            axisLine={false}
            tickLine={false}
            minTickGap={MIN_TICK_GAP_PX}
          />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: COLORS.cursor, strokeDasharray: "3 3" }}
            content={({ active, label }) => (
              <PriceTooltip active={active} label={label} closes={closes} currency={currency} />
            )}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke={COLORS.line}
            strokeWidth={LINE_WIDTH_PX}
            fill={`url(#${fillId})`}
            activeDot={{ r: DOT_RADIUS_PX, fill: COLORS.line }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
