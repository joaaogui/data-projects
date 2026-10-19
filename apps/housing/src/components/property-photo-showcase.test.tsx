// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PropertyCardPhotoShowcase,
  canonicalPhotoHost,
  completedPhotoFetchKeys,
  fetchPropertyPhotosShared,
  getCardPhotoUrl,
  getClientDescriptionCached,
  getClientPhotosCacheSize,
  getClientPhotosCached,
  getFallbackPhotoUrl,
  getHighResPhotoUrl,
  getThumbPhotoUrl,
  handleImgError,
  setClientPhotosCached,
} from "./property-photo-showcase";
import type { EvaluatedProperty } from "@/types/housing";

let uid = 0;
function uniq(prefix: string) {
  uid += 1;
  return `${prefix}-${uid}`;
}

function makeProperty(
  overrides: Partial<EvaluatedProperty> = {},
): EvaluatedProperty {
  return {
    provider: "quintoandar",
    id: uniq("p"),
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua de Teste",
    streetNumber: "100",
    condominiumName: null,
    doorman: null,
    url: "https://example.com/imovel/x",
    title: "Apartamento Teste",
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
    samplePhotos: [
      { room: "Sala", url: "https://example.com/1.jpg" },
      { room: "Quarto", url: "https://example.com/2.jpg" },
      { room: "Cozinha", url: "https://example.com/3.jpg" },
    ],
    description: "Descrição",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    publishedAt: "2020-01-01T00:00:00.000Z",
    isActive: true,
    furnitureTier: "UNFURNISHED",
    listingAgeLabel: "3 dias",
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

function jsonRes(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("photo URL helpers", () => {
  it("canonicalizes the bare QuintoAndar host and upgrades to high-res", () => {
    expect(canonicalPhotoHost("https://quintoandar.com.br/img/med/a.jpg")).toBe(
      "https://www.quintoandar.com.br/img/med/a.jpg",
    );
    expect(canonicalPhotoHost("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg",
    );
    expect(
      getHighResPhotoUrl("https://quintoandar.com.br/img/med/a.jpg"),
    ).toBe("https://www.quintoandar.com.br/img/xxl/a.jpg");
    expect(
      getHighResPhotoUrl(
        "https://resizedimgs.zapimoveis.com.br/x.jpg?dimension=800x600",
      ),
    ).toContain("dimension=1920x1440");
    expect(
      getHighResPhotoUrl(
        "https://resizedimgs.vivareal.com/x.jpg?dimension=800x600",
      ),
    ).toContain("dimension=1920x1440");
    expect(
      getHighResPhotoUrl("https://imovelwebcdn.com/avisos/1/720x532/a.jpg"),
    ).toContain("/1200x1200/");
    expect(getHighResPhotoUrl("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg",
    );
    expect(getHighResPhotoUrl("")).toBe("");
  });

  it("right-sizes card and thumb URLs per provider", () => {
    expect(
      getCardPhotoUrl("https://www.quintoandar.com.br/img/xxl/a.jpg"),
    ).toContain("/img/med/");
    expect(
      getCardPhotoUrl(
        "https://resizedimgs.zapimoveis.com.br/x.jpg?dimension=1920x1440",
      ),
    ).toContain("dimension=480x360");
    expect(
      getCardPhotoUrl("https://imovelwebcdn.com/avisos/1/1200x1200/a.jpg"),
    ).toContain("/360x266/");
    expect(
      getThumbPhotoUrl(
        "https://resizedimgs.vivareal.com/x.jpg?dimension=1920x1440",
      ),
    ).toContain("dimension=360x270");
    expect(
      getThumbPhotoUrl("https://imovelwebcdn.com/avisos/1/720x532/a.jpg"),
    ).toContain("/360x266/");
    expect(getCardPhotoUrl("")).toBe("");
    expect(getThumbPhotoUrl("")).toBe("");
    expect(getCardPhotoUrl("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg",
    );
  });

  it("walks the fallback chain and returns the original as a last resort", () => {
    expect(
      getFallbackPhotoUrl(
        "https://www.quintoandar.com.br/img/xxl/a.jpg",
        "https://quintoandar.com.br/img/xxl/a.jpg",
      ),
    ).toContain("/img/xl/");
    expect(
      getFallbackPhotoUrl(
        "https://www.quintoandar.com.br/img/xl/a.jpg",
        "https://quintoandar.com.br/img/xl/a.jpg",
      ),
    ).toContain("/img/med/");
    expect(
      getFallbackPhotoUrl(
        "https://x.com/a.jpg?dimension=1920x1440",
        "https://x.com/a.jpg?dimension=1920x1440",
      ),
    ).toContain("dimension=1280x960");
    expect(
      getFallbackPhotoUrl(
        "https://x.com/a.jpg?dimension=1280x960",
        "https://x.com/a.jpg?dimension=1280x960",
      ),
    ).toContain("dimension=870x707");
    expect(
      getFallbackPhotoUrl(
        "https://x.com/a.jpg?dimension=870x707",
        "https://x.com/a.jpg?dimension=870x707",
      ),
    ).toContain("dimension=800x600");
    expect(
      getFallbackPhotoUrl(
        "https://x.com/a.jpg?dimension=480x360",
        "https://x.com/a.jpg?dimension=480x360",
      ),
    ).toContain("dimension=800x600");
    expect(
      getFallbackPhotoUrl(
        "https://x.com/a.jpg?dimension=360x270",
        "https://x.com/a.jpg?dimension=360x270",
      ),
    ).toContain("dimension=800x600");
    expect(
      getFallbackPhotoUrl(
        "https://imovelwebcdn.com/avisos/1/1200x1200/a.jpg",
        "https://imovelwebcdn.com/avisos/1/1200x1200/a.jpg",
      ),
    ).toContain("/720x532/");
    expect(
      getFallbackPhotoUrl(
        "https://imovelwebcdn.com/avisos/1/730x532/a.jpg",
        "https://imovelwebcdn.com/avisos/1/730x532/a.jpg",
      ),
    ).toContain("/720x532/");
    expect(
      getFallbackPhotoUrl(
        "https://imovelwebcdn.com/avisos/1/720x532/a.jpg",
        "https://imovelwebcdn.com/avisos/1/720x532/a.jpg",
      ),
    ).toContain("/360x266/");
    // No fallback left when the failed URL already is the canonical original
    expect(
      getFallbackPhotoUrl(
        "https://example.com/a.jpg",
        "https://example.com/a.jpg",
      ),
    ).toBeNull();
    // Different failed URL falls back to the canonical original
    expect(
      getFallbackPhotoUrl(
        "https://cdn.example.com/a.jpg",
        "https://example.com/a.jpg",
      ),
    ).toBe("https://example.com/a.jpg");
  });

  it("handleImgError steps down resolution and gives up after 4 attempts", () => {
    const img = document.createElement("img");
    img.src = "https://www.quintoandar.com.br/img/xxl/a.jpg";
    const original = "https://www.quintoandar.com.br/img/xxl/a.jpg";
    const evt = { currentTarget: img } as never;

    handleImgError(evt, original);
    expect(img.dataset.fallbackAttempts).toBe("1");
    expect(img.src).toContain("/img/xl/");

    handleImgError(evt, original);
    expect(img.src).toContain("/img/med/");
    expect(img.dataset.fallbackAttempts).toBe("2");

    img.dataset.fallbackAttempts = "4";
    handleImgError(evt, original);
    expect(img.dataset.fallbackExhausted).toBe("true");
    expect(img.style.opacity).toBe("0");
  });

  it("handleImgError exhausts when no fallback exists", () => {
    const img = document.createElement("img");
    img.src = "https://example.com/a.jpg";
    handleImgError(
      { currentTarget: img } as never,
      "https://example.com/a.jpg",
    );
    expect(img.dataset.fallbackExhausted).toBe("true");
    expect(img.style.opacity).toBe("0");
  });
});

describe("client photo/description caches", () => {
  it("returns undefined for misses and the stored photos for hits", () => {
    const key = uniq("key");
    expect(getClientPhotosCached(key)).toBeUndefined();
    const photos = [{ room: "Sala", url: "https://example.com/a.jpg" }];
    setClientPhotosCached(key, photos);
    expect(getClientPhotosCached(key)).toEqual(photos);
    expect(getClientPhotosCacheSize()).toBeGreaterThanOrEqual(1);
    expect(getClientDescriptionCached(uniq("desc"))).toBeNull();
  });
});

describe("fetchPropertyPhotosShared", () => {
  it("dedupes in-flight requests, caches photos and the description", async () => {
    const id = uniq("fetch");
    const photos = [{ room: "Sala", url: "https://example.com/f.jpg" }];
    const fetchMock = vi.fn(async () =>
      jsonRes({ ok: true, photos, description: "Descrição via API" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const params = {
      provider: "quintoandar",
      id,
      url: "https://example.com/imovel/x",
    };
    const [a, b] = await Promise.all([
      fetchPropertyPhotosShared(params),
      fetchPropertyPhotosShared(params),
    ]);
    expect(a).toEqual(photos);
    expect(b).toEqual(photos);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      String((fetchMock.mock.calls[0] as unknown[] | undefined)?.[0] ?? ""),
    ).toContain("/api/photos?");
    expect(getClientPhotosCached(`quintoandar:${id}`)).toEqual(photos);
    expect(getClientDescriptionCached(`quintoandar:${id}`)).toBe(
      "Descrição via API",
    );
    expect(completedPhotoFetchKeys.has(`quintoandar:${id}`)).toBe(true);
  });

  it("returns [] on non-ok responses and on network errors", async () => {
    const idA = uniq("fetchA");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes({ ok: false }, false)),
    );
    await expect(
      fetchPropertyPhotosShared({
        provider: "vivareal",
        id: idA,
        url: "https://example.com/x",
      }),
    ).resolves.toEqual([]);

    const idB = uniq("fetchB");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(
      fetchPropertyPhotosShared({
        provider: "vivareal",
        id: idB,
        url: "https://example.com/x",
      }),
    ).resolves.toEqual([]);
  });

  it("returns [] when the payload has no photo array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes({ ok: true })),
    );
    await expect(
      fetchPropertyPhotosShared({
        provider: "zap",
        id: uniq("fetchC"),
        url: "https://example.com/x",
      }),
    ).resolves.toEqual([]);
  });
});

describe("PropertyCardPhotoShowcase", () => {
  it("shows the empty state when there are no photos and fetching already completed", () => {
    const property = makeProperty({ samplePhotos: [], photosCount: 0 });
    completedPhotoFetchKeys.add(
      `${property.provider}:${property.id}`,
    );
    render(
      <PropertyCardPhotoShowcase
        property={property}
        onOpenGallery={vi.fn()}
      />,
    );
    expect(screen.getByText("Sem fotos disponíveis")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
  });

  it("fetches photos on mount when empty and then renders them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonRes({
          ok: true,
          photos: [{ room: "Sala", url: "https://example.com/f1.jpg" }],
        }),
      ),
    );
    const property = makeProperty({ samplePhotos: [], photosCount: 1 });
    render(
      <PropertyCardPhotoShowcase
        property={property}
        onOpenGallery={vi.fn()}
      />,
    );
    expect(await screen.findByAltText("Sala")).toBeTruthy();
  });

  it("renders a single photo and opens the gallery on click and Enter", () => {
    const onOpenGallery = vi.fn();
    const property = makeProperty({
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
      photosCount: 1,
    });
    render(
      <PropertyCardPhotoShowcase
        property={property}
        onOpenGallery={onOpenGallery}
      />,
    );
    expect(screen.getByText("Ampliar")).toBeTruthy();
    fireEvent.click(screen.getByAltText("Sala"));
    expect(onOpenGallery).toHaveBeenCalledWith(0);

    const region = screen.getByRole("button", {
      name: /Abrir foto ampliada/,
    });
    fireEvent.keyDown(region, { key: "Enter" });
    expect(onOpenGallery).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(region, { key: "a" });
    expect(onOpenGallery).toHaveBeenCalledTimes(2);
  });

  it("renders two photos with inline navigation and a secondary tile", () => {
    const onOpenGallery = vi.fn();
    const property = makeProperty({
      samplePhotos: [
        { room: "Sala", url: "https://example.com/1.jpg" },
        { room: "Quarto", url: "https://example.com/2.jpg" },
      ],
      photosCount: 2,
    });
    render(
      <PropertyCardPhotoShowcase
        property={property}
        onOpenGallery={onOpenGallery}
      />,
    );
    expect(screen.getByText("Ver 2 fotos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
    expect(screen.getByText(/2\/2 · Galeria/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Foto anterior" }));
    expect(screen.getByText(/1\/2 · Galeria/)).toBeTruthy();
    fireEvent.click(screen.getByAltText("Quarto"));
    expect(onOpenGallery).toHaveBeenCalledWith(1);
  });

  it("renders the 3+ bento layout, cycles the hero and opens tiles", () => {
    const onOpenGallery = vi.fn();
    const property = makeProperty({ photosCount: 5 });
    render(
      <PropertyCardPhotoShowcase
        property={property}
        onOpenGallery={onOpenGallery}
      />,
    );
    expect(screen.getByText("+2 fotos")).toBeTruthy();
    expect(screen.getAllByText(/Galeria \(5\)/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
    expect(screen.getByText(/2\/3 · Ver Galeria \(5\)/)).toBeTruthy();
    fireEvent.click(screen.getByAltText("Cozinha"));
    expect(onOpenGallery).toHaveBeenCalledWith(2);
  });

  it("opens tiles via keyboard in the 3+ layout", () => {
    const onOpenGallery = vi.fn();
    render(
      <PropertyCardPhotoShowcase
        property={makeProperty({ photosCount: 3 })}
        onOpenGallery={onOpenGallery}
      />,
    );
    fireEvent.keyDown(
      screen.getByLabelText(/Abrir galeria completa \(3 fotos\)/),
      { key: "Enter" },
    );
    expect(onOpenGallery).toHaveBeenCalledWith(2);
    fireEvent.keyDown(
      screen.getByLabelText(/Abrir galeria de fotos \(3 fotos\) na foto 1/),
      { key: " " },
    );
    expect(onOpenGallery).toHaveBeenCalledWith(0);
    fireEvent.keyDown(
      screen.getByLabelText(/Abrir galeria de fotos \(3 fotos\) na foto 1/),
      { key: "a" },
    );
    expect(onOpenGallery).toHaveBeenCalledTimes(2);
  });

  it("toggles the favorite overlay without opening the gallery", () => {
    const onOpenGallery = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <PropertyCardPhotoShowcase
        property={makeProperty({
          samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
          photosCount: 1,
        })}
        onOpenGallery={onOpenGallery}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar aos favoritos/ }),
    );
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onOpenGallery).not.toHaveBeenCalled();
  });

  it("shows Desativado for inactive listings and Novo for recent ones", () => {
    const { rerender } = render(
      <PropertyCardPhotoShowcase
        property={makeProperty({
          isActive: false,
          samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
          photosCount: 1,
        })}
        onOpenGallery={vi.fn()}
      />,
    );
    expect(screen.getByText("Desativado")).toBeTruthy();

    rerender(
      <PropertyCardPhotoShowcase
        property={makeProperty({
          listingAgeDays: 1,
          samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
          photosCount: 1,
        })}
        onOpenGallery={vi.fn()}
      />,
    );
    expect(screen.getByText("Novo")).toBeTruthy();
  });
});
