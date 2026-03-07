"use client";

import { useMemo } from "react";
import type { VideoData } from "@/types/youtube";

export type QuickFilterId = "all" | "excellent" | "recent" | "short" | "long" | "viral" | "hidden-gems";

interface QuickFilterDef {
  id: QuickFilterId;
  label: string;
  predicate: (v: VideoData) => boolean;
}

const FILTER_DEFS: QuickFilterDef[] = [
  { id: "all", label: "All", predicate: () => true },
  { id: "excellent", label: "Excellent", predicate: (v) => v.score >= 70 },
  { id: "recent", label: "Recent <30d", predicate: (v) => v.days < 30 },
  { id: "short", label: "Short <5min", predicate: (v) => v.duration < 300 },
  { id: "long", label: "Long >20min", predicate: (v) => v.duration > 1200 },
  { id: "viral", label: "Viral >100K", predicate: (v) => v.views > 100_000 },
  {
    id: "hidden-gems",
    label: "Hidden Gems",
    predicate: (v) => v.rates?.engagementRate > 40 && v.views < 50_000,
  },
];

interface QuickFiltersProps {
  videos: VideoData[];
  activeFilters: Set<QuickFilterId>;
  onToggle: (id: QuickFilterId) => void;
}

export function getFilterPredicate(activeFilters: Set<QuickFilterId>): ((v: VideoData) => boolean) | null {
  if (activeFilters.size === 0 || activeFilters.has("all")) return null;

  const activeDefs = FILTER_DEFS.filter((d) => d.id !== "all" && activeFilters.has(d.id));
  if (activeDefs.length === 0) return null;

  return (v: VideoData) => activeDefs.every((d) => d.predicate(v));
}

export function QuickFilters({ videos, activeFilters, onToggle }: Readonly<QuickFiltersProps>) {
  const counts = useMemo(() => {
    const map = new Map<QuickFilterId, number>();
    for (const def of FILTER_DEFS) {
      map.set(def.id, def.id === "all" ? videos.length : videos.filter(def.predicate).length);
    }
    return map;
  }, [videos]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTER_DEFS.map((def) => {
        const count = counts.get(def.id) ?? 0;
        const isActive = def.id === "all" ? activeFilters.size === 0 || activeFilters.has("all") : activeFilters.has(def.id);

        if (def.id !== "all" && count === 0) return null;

        return (
          <button
            key={def.id}
            onClick={() => onToggle(def.id)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all
              ${isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            `}
          >
            {def.label}
            <span className={`tabular-nums ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
