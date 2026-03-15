"use client";

import { capture } from "@/lib/analytics";
import type { VideoData } from "@/types/youtube";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type VisibilityState,
} from "@data-projects/ui";
import { Check, Columns3, Download, Search, SlidersHorizontal, X } from "lucide-react";
import type { RefObject } from "react";
import { AIDrawer } from "../ai-query-chat";
import { DEFAULT_WEIGHTS, METRIC_TYPES, type MetricWeights } from "../metric-icon";
import { WeightsEditor } from "../weights-editor";

export const WEIGHTS_STORAGE_KEY = "youtube-metric-weights";
export const COLUMNS_STORAGE_KEY = "youtube-column-visibility";
export const TABLE_MODE_KEY = "youtube-table-mode";

export type TableMode = "essential" | "full";

export const ESSENTIAL_COLUMNS: VisibilityState = {
  liked: false,
  duration: false,
  days: false,
  viewsPerDay: false,
  viewsPerHour: false,
  viewsPerContentMin: false,
  likes: false,
  comments: false,
};

export function loadTableModeFromStorage(): TableMode {
  if (typeof window === "undefined") return "essential";
  try {
    const stored = localStorage.getItem(TABLE_MODE_KEY);
    if (stored === "full" || stored === "essential") return stored;
    const hasExistingPrefs = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (hasExistingPrefs) return "full";
  } catch { /* noop */ }
  return "essential";
}

export function saveTableModeToStorage(mode: TableMode): void {
  try {
    localStorage.setItem(TABLE_MODE_KEY, mode);
  } catch { /* noop */ }
}

export const DEFAULT_HIDDEN_COLUMNS: VisibilityState = {
  viewsPerDay: false,
  viewsPerHour: false,
  viewsPerContentMin: false,
  likes: false,
  comments: false,
};

export const COLUMN_LABELS: Record<string, string> = {
  title: "Title",
  score: "Score",
  duration: "Duration",
  days: "Age",
  views: "Views",
  engagement: "Engagement",
  viewsPerDay: "Views/Day",
  viewsPerHour: "Views/Hour",
  viewsPerContentMin: "Views/Dur",
  likes: "Likes",
  comments: "Comments",
};

export const TOGGLEABLE_COLUMNS = [
  "duration", "days", "views", "engagement",
  "viewsPerDay", "viewsPerHour", "viewsPerContentMin",
  "likes", "comments",
];

export function loadWeightsFromStorage(): MetricWeights {
  if (typeof window === "undefined") return { ...DEFAULT_WEIGHTS };
  try {
    const stored = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_WEIGHTS, ...parsed };
    }
  } catch (err) {
    console.warn("[VideosTable] Failed to load weights from storage:", err);
  }
  return { ...DEFAULT_WEIGHTS };
}

export function saveWeightsToStorage(weights: MetricWeights): void {
  try {
    localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  } catch (err) {
    console.warn("[VideosTable] Failed to save weights to storage:", err);
  }
}

export function loadColumnsFromStorage(): VisibilityState {
  if (typeof window === "undefined") return { ...DEFAULT_HIDDEN_COLUMNS };
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.warn("[VideosTable] Failed to load columns from storage:", err);
  }
  return { ...DEFAULT_HIDDEN_COLUMNS };
}

export function saveColumnsToStorage(visibility: VisibilityState): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch (err) {
    console.warn("[VideosTable] Failed to save columns to storage:", err);
  }
}

function ColumnVisibilityToggle({
  visibility,
  onChange,
}: Readonly<{
  visibility: VisibilityState;
  onChange: (visibility: VisibilityState) => void;
}>) {
  const hiddenCount = TOGGLEABLE_COLUMNS.filter(id => visibility[id] === false).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2" aria-label="Toggle columns">
          <Columns3 className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Columns</span>
          {hiddenCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({TOGGLEABLE_COLUMNS.length - hiddenCount}/{TOGGLEABLE_COLUMNS.length})
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5">
        <div className="flex flex-col">
          {TOGGLEABLE_COLUMNS.map((id) => {
            const isVisible = visibility[id] !== false;
            return (
              <button
                key={id}
                onClick={() => onChange({ ...visibility, [id]: !isVisible })}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  {isVisible && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                {COLUMN_LABELS[id] ?? id}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  searchInput,
  onSearchInputChange,
  searchInputRef,
  columnVisibility,
  onColumnVisibilityChange,
  weights,
  onWeightsChange,
  processedData,
  onHighlight,
  onExportCsv,
  tableMode,
  onTableModeChange,
}: Readonly<{
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
  weights: MetricWeights;
  onWeightsChange: (weights: MetricWeights) => void;
  processedData: VideoData[];
  onHighlight: (ids: Set<string>) => void;
  onExportCsv: () => void;
  tableMode: TableMode;
  onTableModeChange: (mode: TableMode) => void;
}>) {
  const isDefaultWeights = METRIC_TYPES.every(
    t => weights[t] === DEFAULT_WEIGHTS[t]
  );

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
      <div className="relative flex-1 max-w-40 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search videos..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          aria-label="Search videos"
          className="h-7 sm:h-8 pl-8 pr-8 text-xs sm:text-sm bg-muted/40 border-transparent rounded-xl focus:border-border"
        />
        {searchInput && (
          <button
            onClick={() => onSearchInputChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {!searchInput && (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            /
          </kbd>
        )}
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <div className="hidden sm:flex items-center rounded-lg border border-border/40 p-0.5">
          <button
            onClick={() => {
              onTableModeChange("essential");
              capture('table_mode_changed', { mode: 'essential' });
            }}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${tableMode === "essential"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
            aria-label="Essential view"
            aria-pressed={tableMode === "essential"}
          >
            Essential
          </button>
          <button
            onClick={() => {
              onTableModeChange("full");
              capture('table_mode_changed', { mode: 'full' });
            }}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${tableMode === "full"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
            aria-label="Full view"
            aria-pressed={tableMode === "full"}
          >
            Full
          </button>
        </div>
        {tableMode === "full" && (
          <>
            <ColumnVisibilityToggle
              visibility={columnVisibility}
              onChange={onColumnVisibilityChange}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2" aria-label="Adjust score weights">
                  <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Weights</span>
                  {!isDefaultWeights && (
                    <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-3">
                <WeightsEditor weights={weights} onChange={onWeightsChange} />
              </PopoverContent>
            </Popover>
          </>
        )}
        <AIDrawer videos={processedData} onHighlight={onHighlight} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 active:scale-95 transition-transform" onClick={() => { onExportCsv(); capture('feature_used', { feature: 'csv_export' }); }} aria-label="Export as CSV">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export as CSV</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
