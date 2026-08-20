"use client";

import type { HeatmapCell } from "@/lib/analytics/temporal";
import { formatHour, formatNumber, WEEKDAY_LABELS } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { Fragment, useMemo } from "react";
import { cellStyle } from "./heatmap-scale";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  cells: HeatmapCell[];
}

export function HourWeekdayHeatmap({ cells }: Readonly<Props>) {
  const { grid, max } = useMemo(() => {
    // weekday is ISODOW (1=Mon), so index 0..6 maps onto WEEKDAY_LABELS.
    const next = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    let peak = 0;
    for (const cell of cells) {
      const row = cell.weekday - 1;
      if (row < 0 || row > 6) continue;
      next[row][cell.hour] = cell.plays;
      if (cell.plays > peak) peak = cell.plays;
    }
    return { grid: next, max: peak };
  }, [cells]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[3px]">
          <div />
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-center text-[9px] leading-none text-muted-foreground"
            >
              {hour % 3 === 0 ? hour : ""}
            </div>
          ))}

          {grid.map((row, weekdayIndex) => (
            <Fragment key={WEEKDAY_LABELS[weekdayIndex]}>
              <div className="flex items-center text-[11px] text-muted-foreground">
                {WEEKDAY_LABELS[weekdayIndex]}
              </div>
              {row.map((plays, hour) => (
                <Tooltip key={`${WEEKDAY_LABELS[weekdayIndex]}-${hour}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="aspect-square rounded-[2px] transition-transform hover:scale-125"
                      style={cellStyle(plays, max)}
                      aria-label={`${WEEKDAY_LABELS[weekdayIndex]} ${formatHour(hour)}: ${formatNumber(plays)} plays`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">
                      {WEEKDAY_LABELS[weekdayIndex]} {formatHour(hour)}
                    </p>
                    <p className="text-muted-foreground">
                      {formatNumber(plays)} plays
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
