"use client";

import { formatNumber } from "@/lib/format";
import { cn } from "@data-projects/shared";
import Link from "next/link";

export interface BarListItem {
  label: string;
  sublabel?: string;
  value: number;
  href?: string;
}

interface BarListProps {
  items: BarListItem[];
  valueFormat?: (value: number) => string;
  className?: string;
}

/**
 * A ranked list where the bar is the row background rather than a separate
 * chart. Cheaper than a recharts bar chart and it keeps labels legible at any
 * width, which matters for long artist names.
 */
export function BarList({ items, valueFormat, className }: Readonly<BarListProps>) {
  const max = items.reduce((peak, item) => Math.max(peak, item.value), 0);

  return (
    <ol className={cn("space-y-1", className)}>
      {items.map((item, index) => {
        const width = max > 0 ? (item.value / max) * 100 : 0;
        const content = (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-data/12"
              style={{ width: `${width}%` }}
              aria-hidden
            />
            <span className="relative w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="relative min-w-0 flex-1 truncate">
              {item.label}
              {item.sublabel && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.sublabel}
                </span>
              )}
            </span>
            <span className="relative shrink-0 text-sm font-medium tabular-nums">
              {valueFormat ? valueFormat(item.value) : formatNumber(item.value)}
            </span>
          </>
        );

        const rowClass =
          "relative flex items-center gap-3 overflow-hidden rounded-sm px-2 py-1.5 text-sm";

        return (
          <li key={`${item.label}-${item.sublabel ?? ""}`}>
            {item.href ? (
              <Link
                href={item.href}
                className={cn(rowClass, "transition-colors hover:bg-accent")}
              >
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
