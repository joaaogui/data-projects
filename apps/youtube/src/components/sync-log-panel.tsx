"use client";

import type { SyncLogEntry } from "@/types/youtube";
import { Skeleton } from "@data-projects/ui";
import { useCallback, useEffect, useRef } from "react";

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const levelColors: Record<SyncLogEntry["level"], string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const levelLabels: Record<SyncLogEntry["level"], string> = {
  info: "INF",
  warn: "WRN",
  error: "ERR",
};

const msgColors: Record<SyncLogEntry["level"], string> = {
  info: "text-foreground/80",
  warn: "text-yellow-200",
  error: "text-red-300",
};

export function SyncLogPanel({
  logs,
  isActive,
  className = "",
}: Readonly<{
  logs: SyncLogEntry[];
  isActive: boolean;
  className?: string;
}>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 40;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  if (logs.length === 0 && isActive) {
    return (
      <div className={`rounded-b-lg border border-t-0 border-border/50 bg-[hsl(var(--background))] p-3 space-y-1.5 ${className}`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3" style={{ width: `${55 - i * 10}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`rounded-b-lg border border-t-0 border-border/50 bg-[hsl(var(--background))] overflow-y-auto font-mono text-xs leading-relaxed ${className}`}
      style={{ maxHeight: 240 }}
    >
      <div className="p-3 space-y-0.5">
        {logs.map((entry, i) => (
          <div key={`${entry.ts}-${i}`} className="flex gap-2">
            <span className="text-muted-foreground/50 shrink-0 select-none">{formatLogTime(entry.ts)}</span>
            <span className={`shrink-0 font-semibold select-none ${levelColors[entry.level]}`}>
              {levelLabels[entry.level]}
            </span>
            <span className={msgColors[entry.level]}>
              {entry.msg}
            </span>
          </div>
        ))}
        {isActive && (
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground/50 shrink-0 select-none">{formatLogTime(Date.now())}</span>
            <span className="inline-block w-1.5 h-3.5 bg-muted-foreground animate-pulse rounded-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
