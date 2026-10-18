import {
  CLEARED_FILTERS,
  PERFEITO_PRESET,
  snapshotFilters,
  type FilterPatch,
  type FilterState,
} from "@/lib/filter-state";
import { parseExplorerFiltersObject, serializeExplorerFilters } from "@/lib/property-filters";
import type { SavedView } from "@/types/housing";

export type { SavedView };

/** v3 adds `savedViews`; v2 rows (no views) read the same way. */
export const PREFERENCES_SCHEMA_VERSION = 3;

/** Weights kept the v2 migration semantics: any preferences schema ≥ 2 means v2 weights. */
export function weightsSchemaVersion(preferencesSchemaVersion: number | undefined): number {
  return (preferencesSchemaVersion ?? 2) >= 2 ? 2 : 1;
}

export const MAX_SAVED_VIEWS = 30;
const MAX_NAME_LENGTH = 60;

export function normalizeSavedViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const id = typeof v.id === "string" ? v.id.trim().slice(0, 80) : "";
    const name = typeof v.name === "string" ? v.name.trim().slice(0, MAX_NAME_LENGTH) : "";
    if (!id || !name || seen.has(id) || id === PERFEITO_VIEW_ID) continue;
    if (!v.filters || typeof v.filters !== "object" || Array.isArray(v.filters)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      filters: v.filters as Record<string, unknown>,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date(0).toISOString(),
    });
    if (out.length >= MAX_SAVED_VIEWS) break;
  }
  return out;
}

export const PERFEITO_VIEW_ID = "perfeito";

export function createSavedView(state: FilterState, name: string, now = new Date()): SavedView {
  const snapshot = snapshotFilters(state);
  return {
    id: `v-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, MAX_NAME_LENGTH) || "Minha visão",
    filters: serializeExplorerFilters({ ...CLEARED_FILTERS, ...snapshot }) as Record<string, unknown>,
    createdAt: now.toISOString(),
  };
}

/** The preset a view applies: every filter field, so it replaces cities and neighborhoods too. */
export function savedViewPreset(view: SavedView): FilterPatch {
  return snapshotFilters(
    parseExplorerFiltersObject({
      ...serializeExplorerFilters(CLEARED_FILTERS),
      ...view.filters,
    }),
  );
}

export const BUILTIN_VIEWS: Array<{ id: string; name: string; preset: FilterPatch }> = [
  { id: PERFEITO_VIEW_ID, name: "Perfeito", preset: PERFEITO_PRESET },
];
