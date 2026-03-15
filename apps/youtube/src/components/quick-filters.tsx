"use client";

import type { VideoData } from "@/types/youtube";
import { Clock, Flame, Gem, Layers, Rocket, Timer, Zap } from "lucide-react";
import { useMemo } from "react";

export type QuickFilterId = "all" | "excellent" | "recent" | "short" | "long" | "viral" | "hidden-gems";

interface QuickFilterDef {
  id: QuickFilterId;
  label: string;
  predicate: (v: VideoData) => boolean;
}

const FILTER_DEFS: QuickFilterDef[] = [
  { id: "all", label: "All", predicate: () => true },
  { id: "excellent", label: "Top Performers", predicate: (v) => v.score >= 70 },
  { id: "recent", label: "Recent <30d", predicate: (v) => v.days < 30 },
  { id: "short", label: "Short <5min", predicate: (v) => v.duration < 300 },
  { id: "long", label: "Long >20min", predicate: (v) => v.duration > 1200 },
  { id: "viral", label: "High Reach", predicate: (v) => v.views > 100_000 },
  {
    id: "hidden-gems",
    label: "Hidden Gems",
    predicate: (v) => v.rates?.engagementRate > 40 && v.views < 50_000,
  },
];

const FILTER_STYLES: Record<QuickFilterId, { icon: typeof Flame; active: string; inactive: string }> = {
  all: { icon: Layers, active: "bg-primary text-primary-foreground shadow-sm shadow-primary/20", inactive: "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground" },
  excellent: { icon: Flame, active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300" },
  recent: { icon: Clock, active: "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300" },
  short: { icon: Zap, active: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300" },
  long: { icon: Timer, active: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-300" },
  viral: { icon: Rocket, active: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300" },
  "hidden-gems": { icon: Gem, active: "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/30", inactive: "bg-muted/60 text-muted-foreground hover:bg-pink-500/10 hover:text-pink-700 dark:hover:text-pink-300" },
};

function buildFilterDefs(videos: VideoData[]): QuickFilterDef[] {
  if (videos.length === 0) return [{ id: "all", label: "All", predicate: () => true }];

  const sortedViews = [...videos].map(v => v.views).sort((a, b) => a - b);
  const sortedScores = [...videos].map(v => v.score).sort((a, b) => a - b);
  const sortedEngagement = [...videos].map(v => v.rates?.engagementRate ?? 0).sort((a, b) => a - b);

  const p = (arr: number[], q: number) => {
    const pos = q * (arr.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? arr[lo] : arr[lo] + (pos - lo) * (arr[hi] - arr[lo]);
  };

  const topScoreThreshold = p(sortedScores, 0.75);
  const highViewThreshold = p(sortedViews, 0.9);
  const lowViewThreshold = p(sortedViews, 0.5);
  const highEngThreshold = p(sortedEngagement, 0.75);

  return [
    { id: "all", label: "All", predicate: () => true },
    { id: "excellent", label: "Top Performers", predicate: (v) => v.score >= topScoreThreshold },
    { id: "recent", label: "Recent <30d", predicate: (v) => v.days < 30 },
    { id: "short", label: "Short <5min", predicate: (v) => v.duration < 300 },
    { id: "long", label: "Long >20min", predicate: (v) => v.duration > 1200 },
    { id: "viral", label: "High Reach", predicate: (v) => v.views >= highViewThreshold },
    { id: "hidden-gems", label: "Hidden Gems", predicate: (v) => (v.rates?.engagementRate ?? 0) >= highEngThreshold && v.views < lowViewThreshold },
  ];
}

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
  const filterDefs = useMemo(() => buildFilterDefs(videos), [videos]);

  const counts = useMemo(() => {
    const map = new Map<QuickFilterId, number>();
    for (const def of filterDefs) {
      map.set(def.id, def.id === "all" ? videos.length : videos.filter(def.predicate).length);
    }
    return map;
  }, [videos, filterDefs]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {filterDefs.map((def) => {
        const count = counts.get(def.id) ?? 0;
        const isActive = def.id === "all" ? activeFilters.size === 0 || activeFilters.has("all") : activeFilters.has(def.id);
        const style = FILTER_STYLES[def.id];
        const Icon = style.icon;

        if (def.id !== "all" && count === 0) return null;

        return (
          <button
            key={def.id}
            onClick={() => onToggle(def.id)}
            aria-pressed={isActive}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium active:scale-95 transition-all duration-200
              ${isActive ? style.active : style.inactive}
            `}
          >
            {def.id !== "all" && <Icon className="h-3 w-3" />}
            {def.label}
            <span className={`tabular-nums text-[11px] ${isActive ? "opacity-70" : "opacity-50"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
