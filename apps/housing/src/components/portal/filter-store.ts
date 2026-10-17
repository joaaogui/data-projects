"use client";

import type { ParsedExplorerFiltersState } from "@/lib/property-filters";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

export type FilterState = ParsedExplorerFiltersState;

export interface FilterStore {
  getState: () => FilterState;
  setState: (next: Partial<FilterState>) => void;
  subscribe: (listener: () => void) => () => void;
}

/** Explorer filter state outside React: components subscribe only to the fields they read. */
export function createFilterStore(initial: FilterState): FilterStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next) => {
      let changed = false;
      for (const key of Object.keys(next) as Array<keyof FilterState>) {
        if (!Object.is(state[key], next[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const FilterStoreContext = createContext<FilterStore | null>(null);

export function useFilterStore(): FilterStore {
  const store = useContext(FilterStoreContext);
  if (!store) throw new Error("FilterStoreContext missing");
  return store;
}

export function useFilterSelector<T>(
  store: FilterStore,
  selector: (state: FilterState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** `useState`-shaped access to one filter field (functional updates supported). */
export function useFilterField<K extends keyof FilterState>(
  store: FilterStore,
  key: K,
): [FilterState[K], Dispatch<SetStateAction<FilterState[K]>>] {
  const value = useFilterSelector(store, (s) => s[key]);
  const setValue = useMemo<Dispatch<SetStateAction<FilterState[K]>>>(
    () => (action) => {
      const prev = store.getState()[key];
      const next =
        typeof action === "function"
          ? (action as (p: FilterState[K]) => FilterState[K])(prev)
          : action;
      store.setState({ [key]: next } as Partial<FilterState>);
    },
    [store, key],
  );
  return [value, setValue];
}
