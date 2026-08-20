"use client";

import { formatNumber } from "@/lib/format";
import { cn } from "@data-projects/shared";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  kind: "area" | "line" | "bar";
  axis?: "left" | "right";
  /**
   * A Tailwind text-colour class. Recharts writes literal `fill`/`stroke`
   * attributes onto the inner paths, which beat both inheritance and a utility
   * class on the wrapper -- so the shapes ask for `currentColor` and this class
   * sets what that resolves to. Keeps the chart on theme tokens in either mode.
   */
  colorClassName?: string;
  format?: (value: number) => string;
}

interface TrendChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  xTickFormat?: (value: string) => string;
  /** Render only every Nth tick when the x axis is dense. */
  xTickInterval?: number;
  rightAxisFormat?: (value: number) => string;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  xTickFormat,
}: Readonly<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  series: TrendSeries[];
  xTickFormat?: (value: string) => string;
}>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">
        {xTickFormat && label ? xTickFormat(label) : label}
      </p>
      {payload.map((item) => {
        const config = series.find((s) => s.key === item.dataKey);
        if (!config) return null;
        const value = item.value ?? 0;
        return (
          <p key={config.key} className="flex gap-3 text-muted-foreground">
            <span>{config.label}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">
              {config.format ? config.format(value) : formatNumber(value)}
            </span>
          </p>
        );
      })}
    </div>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 260,
  xTickFormat,
  xTickInterval,
  rightAxisFormat,
}: Readonly<TrendChartProps>) {
  const hasRightAxis = series.some((s) => s.axis === "right");

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      {/* Margins leave room for a five-digit left tick and the final x label. */}
      <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid
          vertical={false}
          className="text-border"
          stroke="currentColor"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          interval={xTickInterval ?? "preserveStartEnd"}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground text-xs"
          tickFormatter={xTickFormat}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground text-xs"
          tickFormatter={(value: number) => formatNumber(value)}
          width={52}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground text-xs"
            tickFormatter={rightAxisFormat}
            width={44}
          />
        )}
        <Tooltip
          cursor={{ className: "fill-muted/40" }}
          content={<ChartTooltip series={series} xTickFormat={xTickFormat} />}
        />
        {series.map((item) => {
          const axisId = item.axis ?? "left";
          const colorClass = cn("text-data", item.colorClassName);

          if (item.kind === "bar") {
            return (
              <Bar
                key={item.key}
                yAxisId={axisId}
                dataKey={item.key}
                className={colorClass}
                fill="currentColor"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            );
          }
          if (item.kind === "area") {
            return (
              <Area
                key={item.key}
                yAxisId={axisId}
                type="monotone"
                dataKey={item.key}
                className={colorClass}
                fill="currentColor"
                fillOpacity={0.15}
                stroke="currentColor"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            );
          }
          return (
            <Line
              key={item.key}
              yAxisId={axisId}
              type="monotone"
              dataKey={item.key}
              className={colorClass}
              stroke="currentColor"
              strokeWidth={1.5}
              dot={false}
              fill="none"
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );

  // Only worth the vertical space once two series share the plot area.
  if (series.length < 2) return chart;

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className={cn(
                "size-2 rounded-[2px] bg-current",
                item.colorClassName ?? "text-data"
              )}
              aria-hidden
            />
            {item.label}
            {item.axis === "right" && (
              <span className="text-muted-foreground/60">(right axis)</span>
            )}
          </li>
        ))}
      </ul>
      {chart}
    </div>
  );
}
