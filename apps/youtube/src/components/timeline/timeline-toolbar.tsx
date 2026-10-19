"use client";

import { Input } from "@data-projects/ui";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Search } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { FOCUS_RING, type TimelineMode } from "./timeline-model";

export const TIMELINE_PANEL_ID = "timeline-panel";

const MODES: readonly TimelineMode[] = ["timeline", "series"];

interface ToolbarProps {
  summary: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  mode: TimelineMode;
  onModeChange: (mode: TimelineMode) => void;
  seriesCount: number;
  newestFirst: boolean;
  onToggleSort: () => void;
  onlySeries: boolean;
  onToggleOnlySeries: () => void;
}

const BUTTON_BASE = `flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${FOCUS_RING}`;

export function TimelineToolbar({
  summary,
  query,
  onQueryChange,
  mode,
  onModeChange,
  seriesCount,
  newestFirst,
  onToggleSort,
  onlySeries,
  onToggleOnlySeries,
}: Readonly<ToolbarProps>) {
  const hasSeries = seriesCount > 0;

  // Roving tabindex: arrows move between the two tabs.
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!hasSeries) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const other: TimelineMode = mode === "timeline" ? "series" : "timeline";
    onModeChange(other);
    event.currentTarget.parentElement
      ?.querySelector<HTMLElement>(`[data-mode="${other}"]`)
      ?.focus();
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
      <p className="w-full text-xs text-muted-foreground sm:w-auto sm:text-sm">{summary}</p>

      <div className="relative w-full sm:ml-auto sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter by title or series..."
          aria-label="Filter videos by title or series name"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Timeline view"
          className="flex h-8 items-center rounded-md border border-border p-0.5"
        >
          {MODES.map((value) => {
            const selected = mode === value;
            const disabled = value === "series" && !hasSeries;
            let label = "Timeline";
            if (value === "series") label = hasSeries ? `Series ${seriesCount}` : "Series";
            return (
              <button
                type="button"
                role="tab"
                key={value}
                data-mode={value}
                aria-selected={selected}
                aria-controls={TIMELINE_PANEL_ID}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => onModeChange(value)}
                onKeyDown={handleTabKeyDown}
                className={`h-full rounded px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {!hasSeries && (
          <span className="text-xs text-muted-foreground">No continuations detected yet</span>
        )}
      </div>

      {mode === "timeline" && hasSeries && (
        <button
          type="button"
          aria-pressed={onlySeries}
          onClick={onToggleOnlySeries}
          className={`${BUTTON_BASE} ${
            onlySeries
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Only series
        </button>
      )}

      <button
        type="button"
        onClick={onToggleSort}
        aria-label={
          newestFirst
            ? "Sorted newest first; switch to oldest first"
            : "Sorted oldest first; switch to newest first"
        }
        className={`${BUTTON_BASE} ml-auto border-border text-muted-foreground hover:text-foreground sm:ml-0`}
      >
        {newestFirst ? (
          <ArrowDownWideNarrow aria-hidden className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpWideNarrow aria-hidden className="h-3.5 w-3.5" />
        )}
        {newestFirst ? "Newest" : "Oldest"}
      </button>
    </div>
  );
}
