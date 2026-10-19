"use client";

import { Input } from "@data-projects/ui";
import { ChevronLeft, ChevronRight, Search, SkipForward } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { DENSITIES, DENSITY_SPECS, type Density } from "./map-layout";
import { FOCUS_RING } from "./timeline-model";

interface MapToolbarProps {
  summary: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  matchPosition: number;
  onJumpToMatch: (direction: -1 | 1) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  onJumpToLatest: () => void;
}

const BUTTON = `flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 ${FOCUS_RING}`;

function matchLabel(query: string, count: number, position: number): string {
  if (!query.trim()) return "";
  if (count === 0) return "No matches";
  return position > 0 ? `${position} of ${count}` : `${count} matches`;
}

export function MapToolbar({
  summary,
  query,
  onQueryChange,
  matchCount,
  matchPosition,
  onJumpToMatch,
  density,
  onDensityChange,
  onJumpToLatest,
}: Readonly<MapToolbarProps>) {
  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onJumpToMatch(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      onQueryChange("");
    }
  };
  const label = matchLabel(query, matchCount, matchPosition);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
      <p className="text-xs text-muted-foreground sm:text-sm">{summary}</p>

      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex" aria-hidden>
        <svg width="28" height="10" viewBox="0 0 28 10" className="text-data">
          <path d="M2 7 V3 H26 V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 3 V8 M20 3 V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        bracket = story, ticks = its episodes
      </span>

      <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
        <div className="relative flex-1 sm:w-60 sm:flex-none">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Find a title or story..."
            aria-label="Find videos by title or story name; Enter jumps to the next match"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span role="status" className="min-w-[4.5rem] text-xs tabular-nums text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          aria-label="Previous match"
          disabled={matchCount === 0}
          onClick={() => onJumpToMatch(-1)}
          className={`${BUTTON} px-1.5`}
        >
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Next match"
          disabled={matchCount === 0}
          onClick={() => onJumpToMatch(1)}
          className={`${BUTTON} px-1.5`}
        >
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div role="group" aria-label="Density" className="flex h-8 items-center rounded-md border border-border p-0.5">
        {DENSITIES.map((value) => {
          const pressed = value === density;
          return (
            <button
              type="button"
              key={value}
              aria-pressed={pressed}
              onClick={() => onDensityChange(value)}
              className={`h-full rounded px-2.5 text-xs font-medium transition-colors ${FOCUS_RING} ${
                pressed ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {DENSITY_SPECS[value].label}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={onJumpToLatest} className={BUTTON}>
        <SkipForward aria-hidden className="h-3.5 w-3.5" />
        Jump to latest
      </button>
    </div>
  );
}
