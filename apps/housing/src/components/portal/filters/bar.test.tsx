// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createFilterStore } from "@/components/portal/filter-store";
import { CLEARED_FILTERS, type FilterState } from "@/lib/filter-state";

import type { PortalController } from "../use-portal-controller";
import { FilterBar } from "./bar";

type Pill = { id: string; label: string; onClear: () => void };

function buildCtl(overrides: Record<string, unknown> = {}) {
  const filterState = (overrides.filterState as FilterState | undefined) ?? CLEARED_FILTERS;
  const ctl = {
    activeAdvancedFilterCount: 0,
    activeFilterPills: [] as Pill[],
    applyFilterPatch: vi.fn(),
    applyPerfeitoFilterPreset: vi.fn(),
    availableNeighborhoodOptions: [],
    cityTop3ByCode: new Map([
      ["BH", { top3Avg: 9.4, top3Names: ["Lourdes", "Savassi", "Funcionários"], cityName: "Belo Horizonte" }],
      ["CP", { top3Avg: 9.1, top3Names: ["Cambuí"], cityName: "Campinas" }],
      ["RJ", { top3Avg: 8.8, top3Names: ["Ipanema"], cityName: "Rio de Janeiro" }],
      ["BSB", { top3Avg: 9.0, top3Names: ["Águas Claras"], cityName: "Brasília" }],
    ]),
    copiedTop50Count: null as number | null,
    deactivatedTotalCount: 0,
    deleteView: vi.fn(),
    enabledHiddenCities: [] as string[],
    favoriteKeys: [] as string[],
    filterState,
    filterStore: createFilterStore(filterState),
    filteredTotal: 42,
    handleCitySelect: vi.fn(),
    handleCopyTop50ForAi: vi.fn(),
    handleToggleHiddenCity: vi.fn(),
    ineligibleActiveCount: 3,
    isPerfeitoPresetActive: false,
    onlyFavorites: false,
    onlyIneligible: false,
    optionCounts: undefined as Record<string, number> | undefined,
    postPropertyQuery: vi.fn(async () => ({ total: 7, optionCounts: {} })),
    queryWeights: {},
    renameView: vi.fn(),
    resetAllFilters: vi.fn(),
    saveCurrentView: vi.fn(),
    searchQuery: "",
    selectableCityList: ["BH", "CP", "RJ"] as string[],
    selectedCities: [] as string[],
    setOnlyFavorites: vi.fn(),
    setSearchQuery: vi.fn(),
    setSortBy: vi.fn(),
    setViewMode: vi.fn(),
    setVisibleCount: vi.fn(),
    showIneligible: false,
    sortBy: "score_desc",
    toggleView: vi.fn(),
    totalBasePoolCount: 100,
    viewMode: "split",
    viewPresets: [],
    visibleFavoriteCount: 0,
    ...overrides,
  };
  return ctl as unknown as PortalController & typeof ctl;
}

/** Applies a React-style updater argument captured by a mock setter. */
function applyUpdater<T>(mock: ReturnType<typeof vi.fn>, prev: T): T {
  const arg = mock.mock.calls.at(-1)?.[0] as T | ((p: T) => T) | undefined;
  return typeof arg === "function" ? (arg as (p: T) => T)(prev) : (arg as T);
}

describe("FilterBar — row 1 (city, search, sort, view, copy)", () => {
  it("renders the city selector with top-3 badges and the search box, without a status row", () => {
    render(<FilterBar ctl={buildCtl()} />);

    const cityGroup = screen.getByRole("group", { name: "Cidade" });
    const bh = within(cityGroup).getByRole("button", { name: /^BH/ });
    expect(bh.textContent).toContain("9.4");
    expect(within(cityGroup).getByRole("button", { name: "Todas" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(cityGroup).queryByRole("button", { name: /^BSB/ })).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Buscar imóveis" })).toBeTruthy();
    expect(screen.queryByTestId("results-status")).toBeNull();
    expect(screen.queryByRole("button", { name: /Limpar tudo/ })).toBeNull();
  });

  it("selects cities through handleCitySelect and shows BSB when it is selectable", () => {
    const ctl = buildCtl({ selectableCityList: ["BH", "CP", "RJ", "BSB"], selectedCities: ["BH"] });
    render(<FilterBar ctl={ctl} />);

    const cityGroup = screen.getByRole("group", { name: "Cidade" });
    expect(within(cityGroup).getByRole("button", { name: /^BH/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(cityGroup).getByRole("button", { name: "Todas" }).getAttribute("aria-pressed")).toBe("false");
    const bsb = within(cityGroup).getByRole("button", { name: /^BSB/ });
    expect(bsb.textContent).toContain("9.0");
    fireEvent.click(bsb);
    expect(ctl.handleCitySelect).toHaveBeenCalledWith("BSB");
    fireEvent.click(within(cityGroup).getByRole("button", { name: "Todas" }));
    expect(ctl.handleCitySelect).toHaveBeenCalledWith("ALL");
  });

  it("updates the search query with a pagination reset and clears it", () => {
    const ctl = buildCtl();
    const { rerender } = render(<FilterBar ctl={ctl} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar imóveis" }), {
      target: { value: "funcionários" },
    });
    expect(ctl.setSearchQuery).toHaveBeenCalledWith("funcionários");
    expect(ctl.setVisibleCount).toHaveBeenCalledWith(30);
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();

    const withQuery = buildCtl({ searchQuery: "savassi" });
    rerender(<FilterBar ctl={withQuery} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(withQuery.setSearchQuery).toHaveBeenCalledWith("");
  });

  it("changes sort and view mode", () => {
    const ctl = buildCtl();
    render(<FilterBar ctl={ctl} />);
    // Desktop and mobile rows both render the controls; CSS picks one per breakpoint.
    fireEvent.change(screen.getAllByLabelText("Ordenar imóveis")[0]!, { target: { value: "price_asc" } });
    expect(ctl.setSortBy).toHaveBeenCalledWith("price_asc");

    const view = screen.getAllByRole("group", { name: "Visualização" })[0]!;
    expect(within(view).getByRole("button", { name: "Lista + mapa" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(view).getByRole("button", { name: "Só lista" }));
    expect(ctl.setViewMode).toHaveBeenCalledWith("list");
    fireEvent.click(within(view).getByRole("button", { name: "Só mapa" }));
    expect(ctl.setViewMode).toHaveBeenCalledWith("map");
  });

  it("copies the Top 50, reflects the copied state and disables on an empty result", () => {
    const ctl = buildCtl();
    const { rerender } = render(<FilterBar ctl={ctl} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar Top 50 para IA" }));
    expect(ctl.handleCopyTop50ForAi).toHaveBeenCalledTimes(1);

    rerender(<FilterBar ctl={buildCtl({ copiedTop50Count: 42 })} />);
    expect(screen.getByRole("button", { name: "Copiado: 42 imóveis" })).toBeTruthy();

    rerender(<FilterBar ctl={buildCtl({ filteredTotal: 0 })} />);
    expect(
      (screen.getByRole("button", { name: "Copiar Top 50 para IA" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("FilterBar — row 2 (Filtros, pinned requirements, presets)", () => {
  it("applies pinned requirement chips instantly and shows their facet counts", () => {
    const ctl = buildCtl({ optionCounts: { "feat:ac": 1234, "price:4500": 87 } });
    render(<FilterBar ctl={ctl} />);
    const pinned = screen.getByLabelText("Requisitos rápidos");

    const ac = within(pinned).getByRole("button", { name: /Ar-cond\./ });
    expect(ac.getAttribute("aria-pressed")).toBe("false");
    expect(ac.textContent).toContain("1,2k");
    fireEvent.click(ac);
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({ requiredFeatures: ["ac"] });

    const price = within(pinned).getByRole("button", { name: /≤ R\$ 4\.500/ });
    expect(price.textContent).toContain("87");
    fireEvent.click(price);
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({ minTotalMonthly: null, maxTotalMonthly: 4500 });

    fireEvent.click(within(pinned).getByRole("button", { name: /Andar alto/ }));
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({
      floorFilters: ["HIGH_OR_TOP"],
      floorFilter: "HIGH_OR_TOP",
    });
  });

  it("toggles an active pinned requirement off", () => {
    const filterState = { ...CLEARED_FILTERS, requiredFeatures: ["ac"], maxCommuteMinutes: 25 } as FilterState;
    const ctl = buildCtl({ filterState });
    render(<FilterBar ctl={ctl} />);
    const pinned = screen.getByLabelText("Requisitos rápidos");

    const ac = within(pinned).getByRole("button", { name: /Ar-cond\./ });
    expect(ac.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(ac);
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({ requiredFeatures: [] });
    fireEvent.click(within(pinned).getByRole("button", { name: /≤ 25 min/ }));
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({ maxCommuteMinutes: null });
  });

  it("toggles favorites (with pagination reset) and the Perfeito preset", () => {
    const ctl = buildCtl({ visibleFavoriteCount: 2 });
    render(<FilterBar ctl={ctl} />);

    const favorites = screen.getAllByRole("button", { name: "Favoritos (2)" })[0]!;
    expect(favorites.textContent).toContain("2");
    fireEvent.click(favorites);
    expect(applyUpdater<boolean>(ctl.setOnlyFavorites as never, false)).toBe(true);
    expect(ctl.setVisibleCount).toHaveBeenCalledWith(30);

    const perfeito = screen.getAllByRole("button", { name: /Perfeito/ })[0]!;
    expect(perfeito.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(perfeito);
    expect(ctl.applyPerfeitoFilterPreset).toHaveBeenCalledTimes(1);
  });

  it("shows the active filter count on Filtros and opens the filters inline below the bar", () => {
    render(<FilterBar ctl={buildCtl({ activeAdvancedFilterCount: 2 })} />);
    const open = screen.getByRole("button", { name: /^Filtros/ });
    expect(open.textContent).toContain("2");
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("filter-sheet")).toBeNull();

    fireEvent.click(open);
    expect(open.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Filtros" });
    expect(screen.getByTestId("filters-bar").contains(panel)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByTestId("filter-sheet")).toBeNull();

    fireEvent.click(open);
    expect(screen.getByTestId("filter-sheet")).toBeTruthy();
    fireEvent.click(open);
    expect(screen.queryByTestId("filter-sheet")).toBeNull();
  });
});

describe("FilterBar — row 3 (status and pills)", () => {
  it("renders active pills, clears them individually and resets all filters", () => {
    const onClearSearch = vi.fn();
    const onClearPrice = vi.fn();
    const ctl = buildCtl({
      activeFilterPills: [
        { id: "search", label: 'Busca: "savassi"', onClear: onClearSearch },
        { id: "price", label: "≤ R$ 4.500", onClear: onClearPrice },
      ],
    });
    render(<FilterBar ctl={ctl} />);

    expect(screen.getByTestId("results-status").textContent).toMatch(/42 de 100/);
    fireEvent.click(screen.getByRole("button", { name: 'Remover filtro Busca: "savassi"' }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro ≤ R$ 4.500" }));
    expect(onClearPrice).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Limpar tudo/ }));
    expect(ctl.resetAllFilters).toHaveBeenCalledTimes(1);
  });

  it("offers the retained-only shortcut only while ineligible listings are hidden", () => {
    const pills = [{ id: "price", label: "≤ R$ 4.500", onClear: vi.fn() }];
    const ctl = buildCtl({ activeFilterPills: pills });
    const { rerender } = render(<FilterBar ctl={ctl} />);

    fireEvent.click(screen.getByRole("button", { name: "3 retidos" }));
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith({ onlyIneligible: true, showIneligible: true });

    rerender(<FilterBar ctl={buildCtl({ activeFilterPills: pills, showIneligible: true })} />);
    expect(screen.queryByRole("button", { name: "3 retidos" })).toBeNull();
  });
});
