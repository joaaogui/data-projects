// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultsView } from "./results-view";
import type { PortalController } from "./use-portal-controller";

// Stub the heavy children: ResultsView's job is wiring, not card/map internals.
vi.mock("@/components/portal/property-card", () => ({
  PropertyCard: (props: {
    prop: { id: string; neighborhood: string };
    cardIdx: number;
  }) => (
    <article data-testid={`card-${props.prop.id}`}>
      Card {props.prop.neighborhood} #{props.cardIdx}
    </article>
  ),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockMap(props: { properties: unknown[] }) {
      return (
        <div data-testid="map-view">
          Mapa ({props.properties.length} imóveis)
        </div>
      );
    },
}));

function fakeProperty(id: string, neighborhood: string) {
  return { provider: "quintoandar", id, neighborhood } as never;
}

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    cardsListRef: { current: null },
    compareKeys: [],
    displayedProperties: [
      fakeProperty("1", "Funcionários"),
      fakeProperty("2", "Savassi"),
    ],
    expandedId: null,
    extraDescriptionsByKey: {},
    extraPhotosByKey: {},
    favoriteKeys: [],
    filteredTotal: 2,
    focusCardInList: vi.fn(),
    focusedPropertyKey: null,
    hoveredPropertyKey: null,
    isQueryLoading: false,
    listMatchesQuery: true,
    mapProperties: [fakeProperty("1", "Funcionários")],
    mountedWindow: { start: 0, end: 16 },
    openChatForProperty: vi.fn(),
    pinnedChatPropertyKey: null,
    qaItemsByPropertyKey: new Map(),
    resetAllFilters: vi.fn(),
    selectedCities: [],
    selectedMapPropertyKey: null,
    setExpandedId: vi.fn(),
    setGalleryState: vi.fn(),
    setHoveredPropertyKey: vi.fn(),
    setSelectedMapPropertyKey: vi.fn(),
    setViewMode: vi.fn(),
    setVisibleCount: vi.fn(),
    showChatDrawer: false,
    toggleCompare: vi.fn(),
    toggleFavorite: vi.fn(),
    viewMode: "list",
    visibleCount: 30,
    ...overrides,
  } as unknown as PortalController;
}

describe("ResultsView", () => {
  it("renders the property cards in list mode without a map", () => {
    render(<ResultsView ctl={buildCtl()} />);
    expect(screen.getByTestId("card-1")).toBeTruthy();
    expect(screen.getByText("Card Savassi #1")).toBeTruthy();
    expect(screen.queryByTestId("map-view")).toBeNull();
    expect(
      screen.queryByText(/Nenhum imóvel encontrado/),
    ).toBeNull();
  });

  it("shows the empty state and resets filters from it", () => {
    const ctl = buildCtl({
      displayedProperties: [],
      filteredTotal: 0,
      mapProperties: [],
    });
    render(<ResultsView ctl={ctl} />);
    expect(
      screen.getByText(/Nenhum imóvel encontrado com a combinação atual/),
    ).toBeTruthy();
    expect(screen.queryByTestId("relaxations")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Limpar tudo/ }));
    expect(ctl.resetAllFilters).toHaveBeenCalledTimes(1);
  });

  it("offers one-filter relaxations from the empty state", () => {
    const patch = { requireParking: false };
    const ctl = buildCtl({
      displayedProperties: [],
      filteredTotal: 0,
      mapProperties: [],
      applyFilterPatch: vi.fn(),
      relaxations: [{ group: "parking", label: "Vaga", count: 1234, patch }],
    } as unknown as Partial<PortalController>);
    render(<ResultsView ctl={ctl} />);
    fireEvent.click(screen.getByRole("button", { name: /Remover Vaga/ }));
    expect(ctl.applyFilterPatch).toHaveBeenCalledWith(patch);
    expect(screen.getByTestId("relaxations").textContent).toContain("+1.234");
  });

  it("suppresses the empty state when a card is focused by key", () => {
    render(
      <ResultsView
        ctl={buildCtl({
          displayedProperties: [],
          filteredTotal: 0,
          focusedPropertyKey: "quintoandar:9",
        })}
      />,
    );
    expect(screen.queryByText(/Nenhum imóvel encontrado/)).toBeNull();
  });

  it("shows the load-more button in list mode and increments the count", () => {
    const ctl = buildCtl({ filteredTotal: 50, visibleCount: 30 });
    render(<ResultsView ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Carregar mais imóveis \(30 de 50\)/ }),
    );
    const updater = vi.mocked(ctl.setVisibleCount).mock.calls[0]![0] as (
      c: number,
    ) => number;
    expect(updater(30)).toBe(60);
  });

  it("hides load-more when everything is loaded", () => {
    render(
      <ResultsView ctl={buildCtl({ filteredTotal: 2, visibleCount: 30 })} />,
    );
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  });

  it("renders the sticky map alongside the list in split mode", () => {
    render(<ResultsView ctl={buildCtl({ viewMode: "split" })} />);
    expect(screen.getByTestId("map-view")).toBeTruthy();
    expect(screen.getByText("Mapa (1 imóveis)")).toBeTruthy();
    expect(screen.getByTestId("card-1")).toBeTruthy();
  });

  it("renders only the map in map mode, with its own load-more", () => {
    const ctl = buildCtl({
      viewMode: "map",
      filteredTotal: 50,
      visibleCount: 30,
    });
    render(<ResultsView ctl={ctl} />);
    expect(screen.getByTestId("map-view")).toBeTruthy();
    expect(screen.queryByTestId("card-1")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Carregar mais imóveis no mapa \(30 de 50\)/,
      }),
    );
    expect(ctl.setVisibleCount).toHaveBeenCalledTimes(1);
  });

  it("dims the list while the query does not match", () => {
    const { container } = render(
      <ResultsView ctl={buildCtl({ listMatchesQuery: false })} />,
    );
    expect(container.querySelector(".opacity-70")).toBeTruthy();
  });
});
