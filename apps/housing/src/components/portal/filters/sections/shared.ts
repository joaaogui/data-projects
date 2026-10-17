"use client";

import type { FilterStore } from "@/components/portal/filter-store";
import { useFilterSelector } from "@/components/portal/filter-store";
import { describeActiveFilters, type FilterPatch, type FilterState } from "@/lib/filter-state";
import type { FilterOption } from "@/lib/filter-options";
import type { NeighborhoodOption } from "@/lib/property-query";
import type { CityHubCode } from "@/types/housing";
import { useCallback, useMemo } from "react";

export interface SectionContext {
  store: FilterStore;
  /** Facet counts by option id (`feat:ac`, `floor:HIGH_OR_TOP`…), computed with the other filters applied. */
  counts?: Record<string, number>;
  neighborhoodOptions: NeighborhoodOption[];
  ineligibleActiveCount: number;
  deactivatedTotalCount: number;
  enabledHiddenCities: CityHubCode[];
  onToggleHiddenCity: (city: CityHubCode) => void;
}

export function useSectionState(store: FilterStore) {
  const state = useFilterSelector(store, (s) => s);
  const set = useCallback((patch: FilterPatch) => store.setState(patch), [store]);
  const groups = useMemo(() => describeActiveFilters(state).map((p) => p.group), [state]);
  const activeIn = useCallback(
    (sectionGroups: readonly string[]) => groups.filter((g) => sectionGroups.includes(g)).length,
    [groups],
  );
  const option = useCallback(
    (opt: FilterOption) => ({ active: opt.isActive(state), onClick: () => set(opt.toggle(state)) }),
    [state, set],
  );
  return { state, set, activeIn, option };
}

export type { FilterState };
