// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { parseExplorerFiltersObject } from "@/lib/property-filters";

import {
  FilterStoreContext,
  createFilterStore,
  useFilterField,
  useFilterSelector,
  useFilterStore,
} from "./filter-store";

function initial() {
  return parseExplorerFiltersObject({});
}

describe("createFilterStore", () => {
  it("returns the initial state and merges partial updates", () => {
    const store = createFilterStore(initial());
    expect(store.getState().searchQuery).toBe("");
    expect(store.getState().maxTotalMonthly).toBe(5000);

    store.setState({ searchQuery: "savassi" });
    expect(store.getState().searchQuery).toBe("savassi");
    // Untouched fields survive the merge
    expect(store.getState().maxTotalMonthly).toBe(5000);
    expect(store.getState().sortBy).toBe("score_desc");
  });

  it("notifies subscribers only when a value actually changes", () => {
    const store = createFilterStore(initial());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ searchQuery: "" }); // same value: no-op
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(store.getState());

    store.setState({ searchQuery: "a", minScore: 80 });
    expect(listener).toHaveBeenCalledTimes(1);

    store.setState({}); // empty partial: no-op
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setState({ searchQuery: "b" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().searchQuery).toBe("b");
  });

  it("supports multiple independent subscribers", () => {
    const store = createFilterStore(initial());
    const a = vi.fn();
    const b = vi.fn();
    const offA = store.subscribe(a);
    store.subscribe(b);
    store.setState({ minScore: 10 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    store.setState({ minScore: 20 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("treats a new array identity as a change even with equal contents", () => {
    const store = createFilterStore(initial());
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ selectedCities: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

function wrapperFor(store: ReturnType<typeof createFilterStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(FilterStoreContext.Provider, { value: store }, children);
  };
}

describe("filter-store hooks", () => {
  it("useFilterStore returns the context store and throws without a provider", () => {
    const store = createFilterStore(initial());
    const { result } = renderHook(() => useFilterStore(), {
      wrapper: wrapperFor(store),
    });
    expect(result.current).toBe(store);

    expect(() => renderHook(() => useFilterStore())).toThrow(
      "FilterStoreContext missing",
    );
  });

  it("useFilterSelector subscribes to a single derived field", () => {
    const store = createFilterStore(initial());
    const { result } = renderHook(
      () => useFilterSelector(store, (s) => s.searchQuery),
      { wrapper: wrapperFor(store) },
    );
    expect(result.current).toBe("");
    act(() => {
      store.setState({ searchQuery: "pinheiros" });
    });
    expect(result.current).toBe("pinheiros");
    // Unrelated changes keep the selected value (re-render is harmless)
    act(() => {
      store.setState({ minScore: 42 });
    });
    expect(result.current).toBe("pinheiros");
  });

  it("useFilterField supports direct and functional updates", () => {
    const store = createFilterStore(initial());
    const { result } = renderHook(
      () => useFilterField(store, "searchQuery"),
      { wrapper: wrapperFor(store) },
    );
    expect(result.current[0]).toBe("");

    act(() => {
      result.current[1]("func");
    });
    expect(store.getState().searchQuery).toBe("func");
    expect(result.current[0]).toBe("func");

    act(() => {
      result.current[1]((prev) => `${prev}ionários`);
    });
    expect(store.getState().searchQuery).toBe("funcionários");
    expect(result.current[0]).toBe("funcionários");
  });

  it("useFilterField writes only its own key", () => {
    const store = createFilterStore(initial());
    const { result } = renderHook(() => useFilterField(store, "minScore"), {
      wrapper: wrapperFor(store),
    });
    act(() => {
      result.current[1](75);
    });
    expect(store.getState().minScore).toBe(75);
    expect(store.getState().searchQuery).toBe("");
    act(() => {
      result.current[1](null);
    });
    expect(store.getState().minScore).toBeNull();
  });
});
