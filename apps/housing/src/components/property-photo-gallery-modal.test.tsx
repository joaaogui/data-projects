// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyPhotoGalleryModal } from "./property-photo-gallery-modal";
import type { EvaluatedProperty } from "@/types/housing";

vi.mock("@/components/property-photo-showcase", () => ({
  CITY_BADGE_MODAL: {
    BH: { ufLabel: "BH", className: "badge-bh" },
    CP: { ufLabel: "CP", className: "badge-cp" },
    RJ: { ufLabel: "RJ", className: "badge-rj" },
    SP: { ufLabel: "SP", className: "badge-sp" },
    BSB: { ufLabel: "BSB · Ref", className: "badge-bsb" },
  },
  completedPhotoFetchKeys: new Set<string>(),
  fetchPropertyPhotosShared: vi.fn(),
  getClientPhotosCached: vi.fn(),
  getHighResPhotoUrl: vi.fn((u: string) => u),
  getThumbPhotoUrl: vi.fn((u: string) => u),
  handleImgError: vi.fn(),
}));

import {
  completedPhotoFetchKeys,
  fetchPropertyPhotosShared,
  getClientPhotosCached,
} from "@/components/property-photo-showcase";

const mockedFetch = vi.mocked(fetchPropertyPhotosShared);
const mockedCached = vi.mocked(getClientPhotosCached);
const completed = completedPhotoFetchKeys as unknown as Set<string>;

const PHOTOS = [
  { room: "Sala", url: "https://example.com/1.jpg" },
  { room: "Quarto", url: "https://example.com/2.jpg" },
  { room: "Cozinha", url: "https://example.com/3.jpg" },
];

function makeProperty(
  overrides: Partial<EvaluatedProperty> = {},
): EvaluatedProperty {
  return {
    provider: "quintoandar",
    id: "1",
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua de Teste",
    streetNumber: "100",
    condominiumName: "Ed. Teste",
    doorman: null,
    url: "https://example.com/imovel/1",
    title: "Apartamento 1",
    rent: 2500,
    condoFee: 500,
    iptu: 100,
    totalMonthly: 3100,
    salePrice: null,
    areaM2: 60,
    bedrooms: 2,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    floor: 5,
    floorRange: null,
    totalFloors: 10,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2015,
    condition: null,
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 3,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: PHOTOS,
    description: "Descrição",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    publishedAt: "2026-09-01T00:00:00.000Z",
    listingUpdatedAt: null,
    isActive: true,
    deactivatedAt: null,
    furnitureTier: "UNFURNISHED",
    commuteMinutes: 15,
    commuteLabel: "15 min",
    listingAgeDays: 3,
    listingAgeLabel: "3 dias",
    firstPublicationAgeLabel: null,
    eligible: true,
    exclusionReason: null,
    finalScore: 88.5,
    cityRank: 1,
    overallRank: 7,
    neighborhoodRank: 1,
    neighborhoodDynamicScore: 9,
    breakdown: {
      neighborhoodPoints: 10,
      modernityPoints: 10,
      nuancesPoints: 5,
      budgetPoints: 5,
      furniturePoints: 5,
      areaPoints: 5,
      parkingPoints: 5,
      safetyPoints: 5,
      commutePoints: 5,
      cityPreferencePoints: 5,
    },
    cardTags: {
      acLabel: null,
      floorTag: null,
      highFloorLabel: null,
      lowFloorLabel: null,
      noParking: false,
      greenTags: [],
      redTags: [],
      warningTags: [],
    },
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "Bom",
    narrativeJustification: "",
    detailedJustification: "",
    ...overrides,
  };
}

beforeEach(() => {
  completed.clear();
  mockedCached.mockReset();
  mockedCached.mockReturnValue(undefined);
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(PHOTOS);
  document.body.style.overflow = "";
});

describe("PropertyPhotoGalleryModal", () => {
  it("renders header, counter and filmstrip for the initial photo", () => {
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Funcionários — Rua de Teste, 100/)).toBeTruthy();
    expect(screen.getByText(/Ed\. Teste/)).toBeTruthy();
    expect(screen.getByText("Foto 1 de 3")).toBeTruthy();
    expect(screen.getAllByText("Sala").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("88.5 pts")).toBeTruthy();
    expect(screen.getByText(/Pacote R\$ 3\.100\/mês/)).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
    // Main image + 3 thumbnails
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole("link", { name: /QuintoAndar/ }).getAttribute("href")).toBe(
      "https://example.com/imovel/1",
    );
  });

  it("navigates with next/prev buttons, thumbnails and arrow keys (wrapping)", () => {
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Próxima foto/ }),
    );
    expect(screen.getByText("Foto 2 de 3")).toBeTruthy();
    expect(screen.getAllByText("Quarto").length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Foto 3 de 3")).toBeTruthy();

    // Wrap forward
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Foto 1 de 3")).toBeTruthy();

    // Wrap backward
    fireEvent.click(screen.getByRole("button", { name: /Foto anterior/ }));
    expect(screen.getByText("Foto 3 de 3")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Foto 2 de 3")).toBeTruthy();

    // Thumbnail click
    const thumbs = screen.getAllByRole("button", { name: /Sala|Quarto|Cozinha|Miniatura/ });
    // Filmstrip buttons contain img with alt = room; click the first thumb container by title-less lookup:
    // Use the image alt click bubbles to button
    fireEvent.click(screen.getByAltText("Sala"));
    expect(screen.getByText("Foto 1 de 3")).toBeTruthy();
    expect(thumbs.length).toBeGreaterThanOrEqual(3);
  });

  it("clamps an out-of-range initialIndex to the last photo", () => {
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        initialIndex={99}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Foto 3 de 3")).toBeTruthy();
  });

  it("toggles zoom via button and image click, and Escape exits zoom before closing", () => {
    const onClose = vi.fn();
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tela cheia máxima/ }));
    expect(screen.getByRole("button", { name: /Reduzir zoom/ })).toBeTruthy();
    // Filmstrip hidden while zoomed: only the stage image remains
    expect(screen.getAllByAltText("Sala")).toHaveLength(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Tela cheia máxima/ })).toBeTruthy();

    // Clicking the main image toggles zoom too
    const main = screen.getAllByAltText("Sala")[0] as HTMLElement;
    // main alt appears for both main img and thumb; the first is the stage image
    fireEvent.click(main);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes via the close button and via backdrop click, but not via inner click", () => {
    const onClose = vi.fn();
    const { container } = render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector("h3")!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Fechar galeria/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(container).toBeTruthy();
  });

  it("calls onToggleFavorite and labels the favorite state", () => {
    const onToggleFavorite = vi.fn();
    const { rerender } = render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    // The favorite button is icon-only (a0e91e0): its state is carried by
    // the aria-label/title and the filled heart, not by visible text.
    const favoriteButton = screen.getByRole("button", {
      name: /Adicionar aos favoritos/,
    });
    fireEvent.click(favoriteButton);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(favoriteButton.getAttribute("title")).toBe("Salvar nos favoritos");
    expect(
      favoriteButton.querySelector("svg")?.getAttribute("class") ?? "",
    ).not.toContain("fill-rose-500");

    rerender(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
        isFavorite
        onToggleFavorite={onToggleFavorite}
      />,
    );
    const favoritedButton = screen.getByRole("button", {
      name: /Remover dos favoritos/,
    });
    expect(favoritedButton.getAttribute("title")).toBe(
      "Remover dos favoritos",
    );
    expect(
      favoritedButton.querySelector("svg")?.getAttribute("class") ?? "",
    ).toContain("fill-rose-500");
  });

  it("returns null when there are no photos", () => {
    const { container } = render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ samplePhotos: [], photosCount: 0 })}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides prev/next for a single photo and shows the deactivated badge", () => {
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty({
          samplePhotos: [PHOTOS[0]!],
          photosCount: 1,
          isActive: false,
          provider: "vivareal",
          streetNumber: null,
          condominiumName: null,
          overallRank: null,
        })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Próxima foto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Foto anterior/ })).toBeNull();
    expect(screen.getByText("Desativado")).toBeTruthy();
    expect(screen.getByText("Foto 1 de 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: /VivaReal/ })).toBeTruthy();
    expect(screen.getByText("#—")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Foto 1 de 1")).toBeTruthy();
  });

  it("labels other providers (netimoveis, imovelweb, zap fallback)", () => {
    const { rerender } = render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ provider: "netimoveis" })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: /Netimóveis/ })).toBeTruthy();
    rerender(
      <PropertyPhotoGalleryModal
        property={makeProperty({ provider: "imovelweb" })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: /ImovelWeb/ })).toBeTruthy();
    rerender(
      <PropertyPhotoGalleryModal
        property={makeProperty({ provider: "zap" })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: /Zap Imóveis/ })).toBeTruthy();
  });

  it("uses cached photos when the cache is longer than the sample photos", () => {
    const cached = [
      ...PHOTOS,
      { room: "Banheiro", url: "https://example.com/4.jpg" },
    ];
    mockedCached.mockReturnValue(cached);
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ photosCount: 4 })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Foto 1 de 4")).toBeTruthy();
  });

  it("fetches remaining photos and reports them via onPhotosLoaded", async () => {
    const fetched = [
      ...PHOTOS,
      { room: "Varanda", url: "https://example.com/4.jpg" },
      { room: "Banheiro", url: "https://example.com/5.jpg" },
    ];
    mockedFetch.mockResolvedValue(fetched);
    const onPhotosLoaded = vi.fn();
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ photosCount: 5 })}
        onClose={vi.fn()}
        onPhotosLoaded={onPhotosLoaded}
      />,
    );
    // fetch is triggered on mount because photosCount (5) > loaded (3)
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "quintoandar", id: "1" }),
    );
    expect(await screen.findByText("Foto 1 de 5")).toBeTruthy();
    expect(onPhotosLoaded).toHaveBeenCalledWith(fetched);
  });

  it("shows the sliding filmstrip window controls for many photos", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      room: `Foto ${i + 1}`,
      url: `https://example.com/m${i}.jpg`,
    }));
    mockedFetch.mockResolvedValue(many);
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ samplePhotos: many, photosCount: 20 })}
        initialIndex={19}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Foto 20 de 20")).toBeTruthy();
    expect(screen.getByTitle("Ir para a primeira foto (#1)")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Ir para a primeira foto (#1)"));
    expect(screen.getByText("Foto 1 de 20")).toBeTruthy();
    expect(screen.getByTitle("Ir para a última foto (#20)")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Ir para a última foto (#20)"));
    expect(screen.getByText("Foto 20 de 20")).toBeTruthy();
  });

  it("adopts longer cached photos that appear after mount", async () => {
    const cached = [
      ...PHOTOS,
      { room: "Banheiro", url: "https://example.com/4.jpg" },
    ];
    // First call (state initializer) misses; the effect re-check hits.
    mockedCached.mockReturnValueOnce(undefined).mockReturnValue(cached);
    const onPhotosLoaded = vi.fn();
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty({ photosCount: 4 })}
        onClose={vi.fn()}
        onPhotosLoaded={onPhotosLoaded}
      />,
    );
    expect(await screen.findByText("Foto 1 de 4")).toBeTruthy();
    expect(onPhotosLoaded).toHaveBeenCalledWith(cached);
  });

  it("traps Tab focus inside the dialog", () => {
    render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    // Tab from the dialog wraps to the first focusable; Shift+Tab to the last.
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("locks body scroll while open and restores it on unmount", () => {
    const { unmount } = render(
      <PropertyPhotoGalleryModal
        property={makeProperty()}
        onClose={vi.fn()}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
