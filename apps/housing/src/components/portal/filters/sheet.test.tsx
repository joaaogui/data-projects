// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createFilterStore } from "@/components/portal/filter-store";
import { CLEARED_FILTERS, type FilterState } from "@/lib/filter-state";

import type { PortalController } from "../use-portal-controller";
import { FilterSheet } from "./sheet";

function buildCtl(initial: Partial<FilterState> = {}, overrides: Record<string, unknown> = {}) {
  const filterStore = createFilterStore({ ...CLEARED_FILTERS, ...initial });
  const ctl = {
    applyFilterPatch: vi.fn(),
    availableNeighborhoodOptions: [
      { name: "Funcionários", count: 2, cityCode: "BH", score: 9.5 },
      { name: "Savassi", count: 1, cityCode: "BH", score: 9.2 },
      { name: "Botafogo", count: 3, cityCode: "RJ", score: 9.0 },
    ],
    deactivatedTotalCount: 5,
    enabledHiddenCities: [] as string[],
    favoriteKeys: ["quintoandar:1"],
    filterStore,
    handleToggleHiddenCity: vi.fn(),
    ineligibleActiveCount: 3,
    postPropertyQuery: vi.fn(async () => ({ total: 42, optionCounts: { "feat:ac": 12 } })),
    queryWeights: { budgetIdeal: 4500 },
    ...overrides,
  };
  return ctl as unknown as PortalController & typeof ctl;
}

function renderSheet(ctl: ReturnType<typeof buildCtl>) {
  const onClose = vi.fn();
  render(<FilterSheet ctl={ctl} onClose={onClose} />);
  return onClose;
}

/** The draft only reaches the portal through "Ver N imóveis"; returns what it applied. */
function applyDraft(ctl: ReturnType<typeof buildCtl>): FilterState {
  fireEvent.click(screen.getByTestId("apply-filters"));
  return ctl.applyFilterPatch.mock.calls.at(-1)![0] as FilterState;
}

function openSection(title: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: title }));
}

describe("FilterSheet — live count, apply and close", () => {
  it("fetches a debounced live count for the draft and labels the apply button with it", async () => {
    const ctl = buildCtl({ onlyFavorites: true });
    renderSheet(ctl);
    expect(screen.getByTestId("apply-filters").textContent).toBe("Ver imóveis");

    await screen.findByText("Ver 42 imóveis");
    expect(ctl.postPropertyQuery).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "count", weights: ctl.queryWeights, favorites: ["quintoandar:1"] }),
      expect.any(AbortSignal),
    );
    // Facet counts from the count query land on the matching chips.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Ar-condicionado/ }).textContent).toContain("12"),
    );
  });

  it("uses the singular for a single result", async () => {
    renderSheet(buildCtl({}, { postPropertyQuery: vi.fn(async () => ({ total: 1 })) }));
    await screen.findByText("Ver 1 imóvel");
  });

  it("keeps edits in a draft until applied, then closes", () => {
    const ctl = buildCtl();
    const onClose = renderSheet(ctl);

    fireEvent.click(screen.getByRole("button", { name: /^Ar-condicionado/ }));
    expect(ctl.applyFilterPatch).not.toHaveBeenCalled();
    expect(ctl.filterStore.getState().requiredFeatures).toEqual([]);

    expect(applyDraft(ctl).requiredFeatures).toEqual(["ac"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Fechar and on Escape without applying", () => {
    const ctl = buildCtl();
    const onClose = renderSheet(ctl);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(ctl.applyFilterPatch).not.toHaveBeenCalled();
  });

  it("Limpar tudo clears the draft filters but keeps view settings", () => {
    const ctl = buildCtl({ requiredFeatures: ["ac"], minScore: 170, sortBy: "price_asc" });
    renderSheet(ctl);
    fireEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
    const applied = applyDraft(ctl);
    expect(applied.requiredFeatures).toEqual([]);
    expect(applied.minScore).toBeNull();
    expect(applied.sortBy).toBe("price_asc");
  });
});

describe("FilterSheet — Preço & tamanho", () => {
  it("drives the price slider, its ideal/teto marks and the exact min/max inputs", () => {
    const ctl = buildCtl();
    renderSheet(ctl);

    const slider = screen.getByRole("slider", { name: "Valor total mensal máximo" });
    fireEvent.change(slider, { target: { value: "6000" } });
    expect(applyDraft(ctl).maxTotalMonthly).toBe(6000);
    fireEvent.change(slider, { target: { value: "8000" } });
    expect(applyDraft(ctl).maxTotalMonthly).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ideal: até R$ 4.500" }));
    expect(applyDraft(ctl).maxTotalMonthly).toBe(4500);
    fireEvent.click(screen.getByRole("button", { name: "teto: até R$ 5.000" }));
    expect(applyDraft(ctl).maxTotalMonthly).toBe(5000);

    expect(screen.queryByLabelText("Valor mensal mínimo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "editar" }));
    fireEvent.change(screen.getByLabelText("Valor mensal mínimo"), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Valor mensal máximo"), { target: { value: "" } });
    const applied = applyDraft(ctl);
    expect(applied.minTotalMonthly).toBe(2000);
    expect(applied.maxTotalMonthly).toBeNull();
  });

  it("selects area presets and custom area bounds", () => {
    const ctl = buildCtl();
    renderSheet(ctl);

    fireEvent.click(screen.getByRole("button", { name: /^45–72 m²/ }));
    expect(applyDraft(ctl)).toMatchObject({ minAreaM2: 45, maxAreaM2: 72 });

    fireEvent.click(screen.getByRole("button", { name: "Personalizar…" }));
    fireEvent.change(screen.getByLabelText("Área mínima (m²)"), { target: { value: "55" } });
    fireEvent.change(screen.getByLabelText("Área máxima (m²)"), { target: { value: "90" } });
    expect(applyDraft(ctl)).toMatchObject({ minAreaM2: 55, maxAreaM2: 90 });
  });

  it("toggles bedrooms, bathrooms and parking (clearing the legacy minimums)", () => {
    const ctl = buildCtl({ minBedrooms: 2, selectedBathrooms: [1] });
    renderSheet(ctl);

    fireEvent.click(within(screen.getByRole("group", { name: "Quartos" })).getByRole("button", { name: "2q" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Banheiros" })).getByRole("button", { name: "1b" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Vagas" })).getByRole("button", { name: "1v" }));
    expect(applyDraft(ctl)).toMatchObject({
      selectedBedrooms: [2],
      minBedrooms: null,
      selectedBathrooms: [],
      selectedParking: [1],
    });
  });
});

describe("FilterSheet — Localização & deslocamento", () => {
  it("sets commute, Top Bairros and safe streets", () => {
    const ctl = buildCtl({ requiredFeatures: ["safe_street"] });
    renderSheet(ctl);

    const commute = screen.getByRole("group", { name: "Tempo até o escritório" });
    fireEvent.click(within(commute).getByRole("button", { name: "≤ 15" }));
    fireEvent.click(screen.getByRole("switch", { name: /Top Bairros/ }));
    const safe = screen.getByRole("switch", { name: "Rua sem problemas de segurança" }) as HTMLInputElement;
    expect(safe.checked).toBe(true);
    fireEvent.click(safe);
    expect(applyDraft(ctl)).toMatchObject({
      maxCommuteMinutes: 15,
      onlyTop20Neighborhoods: true,
      onlySafeStreets: false,
      requiredFeatures: [],
    });
  });

  it("toggles neighborhoods with city-qualified keys and filters the list by search", () => {
    const ctl = buildCtl({ selectedNeighborhoods: ["BH:Savassi"] });
    renderSheet(ctl);
    expect(screen.getByText("Bairros (3)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Funcionários/ }));
    fireEvent.click(screen.getByRole("button", { name: /Savassi/ }));
    expect(applyDraft(ctl).selectedNeighborhoods).toEqual(["BH:Funcionários"]);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar bairro" }), { target: { value: "botafogo" } });
    expect(screen.getByRole("button", { name: /Botafogo/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Savassi/ })).toBeNull();
  });

  it("stores bare neighborhood names when a single city is selected", () => {
    const ctl = buildCtl({ selectedCities: ["BH"] });
    renderSheet(ctl);
    fireEvent.click(screen.getByRole("button", { name: /Funcionários/ }));
    expect(applyDraft(ctl).selectedNeighborhoods).toEqual(["Funcionários"]);
  });
});

describe("FilterSheet — Apartamento and Prédio & vaga", () => {
  it("toggles floor, features and furniture (deriving the legacy furnished filter)", () => {
    const ctl = buildCtl();
    renderSheet(ctl);

    fireEvent.click(screen.getByRole("button", { name: /^Alto \/ cobertura/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Mobiliado/ }));
    let applied = applyDraft(ctl);
    expect(applied).toMatchObject({ floorFilters: ["HIGH_OR_TOP"], floorFilter: "HIGH_OR_TOP" });
    expect(applied.selectedFurnitureTiers).toEqual(["FULLY_FURNISHED"]);
    expect(applied.furnishedFilter).not.toBe("ALL");

    fireEvent.click(screen.getByRole("button", { name: "Indiferente" }));
    applied = applyDraft(ctl);
    expect(applied.selectedFurnitureTiers).toEqual([]);
    expect(applied.furnishedFilter).toBe("ALL");
  });

  it("toggles building features, conservation tiers and exclusions", () => {
    const ctl = buildCtl({ modernityTiers: ["DATED"] });
    renderSheet(ctl);

    fireEvent.click(screen.getByRole("button", { name: /^Vaga livre/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Novo \/ reformado/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Antigo/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Ocultar megacondomínios" }));
    fireEvent.click(screen.getByRole("switch", { name: /Ocultar também à venda/ }));
    expect(applyDraft(ctl)).toMatchObject({
      requiredFeatures: ["free_parking"],
      modernityTiers: ["MODERN_OR_RENOVATED"],
      hideMegaCondo: true,
      hideForSale: true,
    });
  });
});

describe("FilterSheet — Anúncio (collapsed by default)", () => {
  it("drives listing age presets, custom dates, new entries, platform and status", () => {
    const ctl = buildCtl();
    renderSheet(ctl);
    expect(screen.queryByRole("button", { name: "≤ 7 dias" })).toBeNull();
    openSection(/^Anúncio/);

    fireEvent.click(screen.getByRole("button", { name: "≤ 7 dias" }));
    expect(applyDraft(ctl)).toMatchObject({ minListingAgeDays: null, maxListingAgeDays: 7 });
    fireEvent.click(screen.getByRole("button", { name: "> 60 dias (negociar)" }));
    expect(applyDraft(ctl)).toMatchObject({ minListingAgeDays: 61, maxListingAgeDays: null });

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("Publicado a partir de"), { target: { value: "2026-01-10" } });
    fireEvent.change(screen.getByLabelText("Publicado até"), { target: { value: "2026-02-10" } });
    fireEvent.click(screen.getByRole("switch", { name: /Só novas entradas/ }));
    fireEvent.click(screen.getByRole("button", { name: "QuintoAndar" }));
    expect(screen.getByText("Status (5 desativados / alugados)")).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Status do anúncio" })).getByRole("button", {
        name: "Incluir desativados",
      }),
    );
    expect(applyDraft(ctl)).toMatchObject({
      minListingAgeDays: null,
      maxListingAgeDays: null,
      listingDateFrom: "2026-01-10",
      listingDateTo: "2026-02-10",
      onlyNewEntries: true,
      providerFilter: "quintoandar",
      deactivatedFilter: "ALL",
    });

    const publishedChips = screen.getByRole("button", { name: "Personalizado" }).parentElement!;
    fireEvent.click(within(publishedChips).getByRole("button", { name: "Qualquer" }));
    expect(applyDraft(ctl)).toMatchObject({ listingDateFrom: "", listingDateTo: "" });
  });
});

describe("FilterSheet — Avançado (collapsed by default)", () => {
  it("sets the minimum score and the 3-state retidos mode", () => {
    const ctl = buildCtl();
    renderSheet(ctl);
    openSection(/^Avançado/);

    fireEvent.click(within(screen.getByRole("group", { name: "Nota mínima" })).getByRole("button", { name: "≥ 185" }));
    expect(applyDraft(ctl).minScore).toBe(185);

    expect(screen.getByText(/Retidos pelas barreiras \(3:/)).toBeTruthy();
    const retidos = screen.getByRole("group", { name: "Retidos" });
    expect(within(retidos).getByRole("button", { name: "Ocultar" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(retidos).getByRole("button", { name: "Incluir" }));
    expect(applyDraft(ctl)).toMatchObject({ showIneligible: true, onlyIneligible: false });
    fireEvent.click(within(retidos).getByRole("button", { name: "Só retidos" }));
    expect(applyDraft(ctl)).toMatchObject({ showIneligible: true, onlyIneligible: true });
  });

  it("toggles hidden-by-default cities through the portal and syncs the draft location scope", () => {
    const ctl = buildCtl({}, { enabledHiddenCities: ["BSB"] });
    ctl.handleToggleHiddenCity.mockImplementation(() =>
      ctl.filterStore.setState({ enabledHiddenCities: ["BSB", "SP"], selectedCities: ["SP"] }),
    );
    renderSheet(ctl);
    openSection(/^Avançado/);

    expect(screen.getByTestId("hidden-cities-section")).toBeTruthy();
    const bsb = screen.getByTestId("toggle-hidden-city-BSB") as HTMLInputElement;
    const sp = screen.getByTestId("toggle-hidden-city-SP") as HTMLInputElement;
    expect(bsb.checked).toBe(true);
    expect(sp.checked).toBe(false);
    expect(screen.getByText(/Brasília — Águas Claras/)).toBeTruthy();
    expect(screen.getByText(/São Paulo \(capital\)/)).toBeTruthy();

    fireEvent.click(sp);
    expect(ctl.handleToggleHiddenCity).toHaveBeenCalledWith("SP");
    expect(applyDraft(ctl)).toMatchObject({ enabledHiddenCities: ["BSB", "SP"], selectedCities: ["SP"] });
  });
});
