"use client";

import type { DayCount } from "@/lib/analytics/temporal";
import { formatDate, formatNumber } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { useMemo } from "react";
import { cellStyle } from "./heatmap-scale";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CELL_PX = 10;
const GAP_PX = 2;

interface Props {
  year: number;
  days: Map<string, number>;
  max: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * One calendar year as a GitHub-style grid: columns are ISO weeks, rows are
 * weekdays. Dates are assembled as plain `YYYY-MM-DD` strings and compared to
 * the same keys the server produced, so no timezone conversion happens twice.
 */
export function CalendarYear({ year, days, max }: Readonly<Props>) {
  const weeks = useMemo(() => {
    const first = new Date(Date.UTC(year, 0, 1));
    const last = new Date(Date.UTC(year, 11, 31));

    // Back up to the Monday on or before Jan 1 so every column is a full week.
    const start = new Date(first);
    const offset = (first.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - offset);

    const columns: { key: string; inYear: boolean; plays: number }[][] = [];
    const cursor = new Date(start);

    while (cursor <= last || cursor.getUTCDay() !== 1) {
      const column: { key: string; inYear: boolean; plays: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const key = `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`;
        column.push({
          key,
          inYear: cursor.getUTCFullYear() === year,
          plays: days.get(key) ?? 0,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      columns.push(column);
      if (columns.length > 54) break;
    }

    return columns;
  }, [year, days]);

  const total = useMemo(
    () =>
      weeks
        .flat()
        .filter((cell) => cell.inYear)
        .reduce((sum, cell) => sum + cell.plays, 0),
    [weeks]
  );

  // A month's label sits above the first column that contains one of its days.
  const monthTicks = useMemo(() => {
    const seen = new Set<number>();
    const ticks: { month: number; column: number }[] = [];
    weeks.forEach((column, index) => {
      for (const cell of column) {
        if (!cell.inYear) continue;
        const month = Number(cell.key.slice(5, 7)) - 1;
        if (!seen.has(month)) {
          seen.add(month);
          ticks.push({ month, column: index });
        }
        break;
      }
    });
    return ticks;
  }, [weeks]);

  const gridWidth = weeks.length * (CELL_PX + GAP_PX);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between" style={{ maxWidth: gridWidth }}>
        <span className="text-sm font-medium tabular-nums">{year}</span>
        <span className="text-xs text-muted-foreground">
          {formatNumber(total)} plays
        </span>
      </div>
      <div className="relative h-3" style={{ width: gridWidth }} aria-hidden>
        {monthTicks.map((tick) => (
          <span
            key={tick.month}
            className="absolute top-0 text-[9px] leading-none text-muted-foreground"
            style={{ left: tick.column * (CELL_PX + GAP_PX) }}
          >
            {MONTH_LABELS[tick.month]}
          </span>
        ))}
      </div>
      <div className="flex gap-[2px]" aria-hidden>
        {weeks.map((column) => (
          <div key={column[0].key} className="flex flex-col gap-[2px]">
            {column.map((cell) => (
              <Tooltip key={cell.key}>
                <TooltipTrigger asChild>
                  <div
                    className="rounded-[2px]"
                    style={{
                      width: CELL_PX,
                      height: CELL_PX,
                      ...(cell.inYear
                        ? cellStyle(cell.plays, max)
                        : { backgroundColor: "transparent" }),
                    }}
                  />
                </TooltipTrigger>
                {cell.inYear && (
                  <TooltipContent>
                    <p className="font-medium">{formatDate(`${cell.key}T00:00:00Z`)}</p>
                    <p className="text-muted-foreground">
                      {formatNumber(cell.plays)} plays
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarHeatmap({ daily }: Readonly<{ daily: DayCount[] }>) {
  const { byDay, years, max } = useMemo(() => {
    const map = new Map<string, number>();
    const yearSet = new Set<number>();
    let peak = 0;
    for (const entry of daily) {
      map.set(entry.day, entry.plays);
      yearSet.add(Number(entry.day.slice(0, 4)));
      if (entry.plays > peak) peak = entry.plays;
    }
    return {
      byDay: map,
      years: [...yearSet].sort((a, b) => b - a),
      max: peak,
    };
  }, [daily]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        {[0, 0.1, 0.3, 0.6, 1].map((step) => (
          <div
            key={step}
            className="rounded-[2px]"
            style={{ width: CELL_PX, height: CELL_PX, ...cellStyle(step * max, max) }}
          />
        ))}
        <span>More</span>
        <span className="ml-auto">Peak: {formatNumber(max)} plays in a day</span>
      </div>
      <div className="space-y-4 overflow-x-auto">
        {years.map((year) => (
          <CalendarYear key={year} year={year} days={byDay} max={max} />
        ))}
      </div>
    </div>
  );
}
