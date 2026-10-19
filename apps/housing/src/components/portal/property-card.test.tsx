// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PropertyCard, type PropertyCardProps } from "./property-card";
import type { PropertyCardDTO } from "@/lib/property-query";
import type { PropertyQuestionItem } from "@/types/housing";

// The photo showcase fetches photos over the network; stub that boundary and
// keep the thumbnail helpers as pure pass-throughs.
vi.mock("@/components/property-photo-showcase", () => ({
  getThumbPhotoUrl: (url: string) => url,
  handleImgError: vi.fn(),
  PropertyCardPhotoShowcase: (props: {
    property: { provider: string; id: string };
    compact?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
    onOpenGallery: (initialIndex: number) => void;
  }) => (
    <div
      data-testid="photo-showcase"
      data-compact={String(Boolean(props.compact))}
      data-favorite={String(Boolean(props.isFavorite))}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.onToggleFavorite?.();
        }}
      >
        stub-favoritar
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.onOpenGallery(2);
        }}
      >
        stub-galeria
      </button>
      <span>
        fotos:{props.property.provider}:{props.property.id}
      </span>
    </div>
  ),
}));

const KEY = "quintoandar:1";

function makeProperty(overrides: Partial<PropertyCardDTO> = {}): PropertyCardDTO {
  return {
    provider: "quintoandar",
    id: "1",
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua de Teste",
    streetNumber: "100",
    condominiumName: null,
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
    installations: ["Elevador"],
    amenities: [],
    comfortCommodities: ["Closet planejado"],
    practicalityCommodities: [],
    placesNearby: [{ name: "Parque Municipal", type: "PARK_OR_GREEN_AREA" }],
    photoCaptions: [],
    photosCount: 8,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: [
      { room: "Sala", url: "https://example.com/1.jpg" },
      { room: "Quarto", url: "https://example.com/2.jpg" },
      { room: "Cozinha", url: "https://example.com/3.jpg" },
    ],
    description: "Descrição curta do anúncio",
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
    overallRank: 1,
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
      floorTag: { label: "5º andar", rarity: "common" },
      highFloorLabel: null,
      lowFloorLabel: null,
      noParking: false,
      greenTags: ["Tem AC"],
      redTags: [],
      warningTags: ["Confira a vaga"],
    },
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "Ótimo custo-benefício. Por outro lado, rua movimentada.",
    narrativeJustification: "Narrativa completa do imóvel.",
    detailedJustification: "Memória de cálculo detalhada.",
    detailsLoaded: false,
    ...overrides,
  };
}

function makeQaItem(
  overrides: Partial<PropertyQuestionItem> = {},
): PropertyQuestionItem {
  return {
    id: "qa-1",
    propertyKey: KEY,
    question: "Vale a pena?",
    status: "answered",
    answer: "Sim, vale pelo custo-benefício.",
    createdAt: "2026-10-01T10:00:00.000Z",
    answeredAt: "2026-10-01T10:01:00.000Z",
    propertySnapshot: {
      title: "Apartamento 1",
      neighborhood: "Funcionários",
      cityCode: "BH",
      street: "Rua de Teste",
      streetNumber: "100",
      condominiumName: null,
      totalMonthly: 3100,
      rent: 2500,
      condoFee: 500,
      iptu: 100,
      areaM2: 60,
      bedrooms: 2,
      bathrooms: 1,
      parkingSpaces: 1,
      floor: 5,
      floorLabel: "5º andar",
      furnished: false,
      modernityScore: 80,
      finalScore: 88.5,
      overallRank: 1,
      url: "https://example.com/imovel/1",
      shortJustification: "Bom imóvel",
      description: "Descrição curta",
    },
    ...overrides,
  };
}

function buildProps(overrides: Partial<PropertyCardProps> = {}): PropertyCardProps {
  return {
    prop: makeProperty(),
    cardIdx: 0,
    isExpanded: false,
    isMapHighlighted: false,
    isNearViewport: true,
    isSelectedOnMap: false,
    isPinnedInChat: false,
    isFav: false,
    viewMode: "list",
    extraPhotos: undefined,
    extraDescription: undefined,
    qaList: [],
    setExpandedId: vi.fn(),
    setHoveredPropertyKey: vi.fn(),
    setSelectedMapPropertyKey: vi.fn(),
    setViewMode: vi.fn(),
    setGalleryState: vi.fn(),
    toggleFavorite: vi.fn(),
    openChatForProperty: vi.fn(),
    ...overrides,
  };
}

describe("PropertyCard — off-viewport placeholder", () => {
  it("renders a compact summary and expands on click without the showcase", () => {
    const props = buildProps({ isNearViewport: false });
    const { container } = render(<PropertyCard {...props} />);

    expect(screen.queryByTestId("photo-showcase")).toBeNull();
    expect(container.textContent).toContain("#1 · Funcionários (BH) — Rua de Teste, 100");
    expect(container.textContent).toContain("88.5 pts");
    expect(container.textContent).toContain("3.100");

    fireEvent.click(container.querySelector("article") as HTMLElement);
    expect(props.setExpandedId).toHaveBeenCalledWith(KEY);
  });

  it("shows a dash rank placeholder when ranks are missing", () => {
    const props = buildProps({
      isNearViewport: false,
      prop: makeProperty({ overallRank: null, streetNumber: null }),
    });
    const { container } = render(<PropertyCard {...props} />);
    expect(container.textContent).toContain("#— · Funcionários (BH) — Rua de Teste");
  });
});

describe("PropertyCard — collapsed card", () => {
  it("renders badges, specs, price, tags and the split pros/cons justification", () => {
    const { container } = render(<PropertyCard {...buildProps()} />);

    expect(screen.getByTestId("photo-showcase")).toBeTruthy();
    expect(screen.getByText("BH")).toBeTruthy();
    expect(container.textContent).toContain("#1 em BH");
    expect(container.textContent).toContain("15 min do Nu");
    expect(container.textContent).toContain("🕒 3 dias");
    expect(container.textContent).toContain("Funcionários — Rua de Teste, 100");
    expect(container.textContent).toContain("60 m²");
    expect(container.textContent).toContain("88.5 pts");
    expect(container.textContent).toContain("R$ 3.100/mês");
    expect(container.textContent).toContain("Alug R$ 2.500 + Cond R$ 500 + IPTU R$ 100");
    expect(screen.getByText("5º andar")).toBeTruthy();
    expect(screen.getByText("Tem AC")).toBeTruthy();
    expect(screen.getByText("Confira a vaga")).toBeTruthy();
    expect(screen.getByText("Prós:")).toBeTruthy();
    expect(screen.getByText("Ótimo custo-benefício.")).toBeTruthy();
    expect(screen.getByText("Ressalvas:")).toBeTruthy();
    expect(screen.getByText("Rua movimentada.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir no QuintoAndar/ })).toBeTruthy();
    expect(
      (screen.getByRole("link", { name: /Abrir no QuintoAndar/ }) as HTMLAnchorElement)
        .href,
    ).toBe("https://example.com/imovel/1");
  });

  it("hides the justification in split mode and shows a single line without cons", () => {
    const split = buildProps({ viewMode: "split" });
    const { container, rerender } = render(<PropertyCard {...split} />);
    expect(screen.queryByText("Prós:")).toBeNull();
    expect(screen.getByTestId("photo-showcase").dataset.compact).toBe("true");

    rerender(
      <PropertyCard
        {...buildProps({
          prop: makeProperty({ shortJustification: "Só pontos positivos aqui." }),
        })}
      />,
    );
    expect(container.textContent).toContain("Só pontos positivos aqui.");
    expect(screen.queryByText("Ressalvas:")).toBeNull();
  });

  it("splits a newline justification into pros and cons", () => {
    const props = buildProps({
      prop: makeProperty({
        shortJustification: "Perto do metrô e silencioso.\nRua com pouco comércio.",
      }),
    });
    render(<PropertyCard {...props} />);
    expect(screen.getByText("Perto do metrô e silencioso.")).toBeTruthy();
    expect(screen.getByText("Rua com pouco comércio.")).toBeTruthy();
  });

  it("shows deactivated, retained and missing-floor states", () => {
    const props = buildProps({
      prop: makeProperty({
        isActive: false,
        deactivatedAt: "2026-09-20T00:00:00.000Z",
        eligible: false,
        exclusionReason: "Modernidade baixa",
        cardTags: {
          acLabel: null,
          floorTag: null,
          highFloorLabel: null,
          lowFloorLabel: null,
          noParking: true,
          greenTags: [],
          redTags: ["Alerta de Segurança na Rua"],
          warningTags: [],
        },
      }),
    });
    const { container } = render(<PropertyCard {...props} />);

    expect(container.textContent).toContain("Desativado / Alugado");
    expect(screen.getByText("Retido pelas barreiras:")).toBeTruthy();
    expect(screen.getByText("Modernidade baixa")).toBeTruthy();
    expect(screen.getByText("Andar não informado")).toBeTruthy();
    expect(screen.getByText("Alerta de Segurança na Rua")).toBeTruthy();
  });

  it("shows condominium, furnished and favorited states", () => {
    const props = buildProps({
      isFav: true,
      isPinnedInChat: true,
      prop: makeProperty({
        condominiumName: "Ed. Horizonte",
        furnitureTier: "FULLY_FURNISHED",
      }),
    });
    const { container } = render(<PropertyCard {...props} />);

    expect(container.textContent).toContain("Condomínio Ed. Horizonte");
    expect(container.textContent).toContain("Mobiliado: Sim");
    expect(container.textContent).not.toMatch(/Semi/);
    // The favorite button is icon-only (a0e91e0): the favorited state is
    // carried by the aria-label/title and the filled heart.
    const favoriteButton = screen.getByRole("button", {
      name: "Remover dos favoritos",
    });
    expect(favoriteButton.getAttribute("title")).toBe(
      "Remover dos favoritos",
    );
    expect(
      favoriteButton.querySelector("svg")?.getAttribute("class") ?? "",
    ).toContain("fill-rose-500");
    expect(screen.getByTestId("photo-showcase").dataset.favorite).toBe("true");
  });
});

describe("PropertyCard — neighbourhood research strip", () => {
  it("shows the strip only when the listing carries a research summary", () => {
    const { rerender } = render(<PropertyCard {...buildProps()} />);
    expect(screen.queryByTestId("neighborhood-research-strip")).toBeNull();

    const props = buildProps({
      prop: makeProperty({
        neighborhoodResearch: {
          key: "BH:Funcionários",
          marista: 6.8,
          maristaSource: "rubric",
          robberyRatio: 1.97,
          densityPerKm2: 13869,
          highlight: "Praça da Liberdade a pé",
          redFlag: "Roubos ~2× a média",
        },
      }),
    });
    rerender(<PropertyCard {...props} />);
    const strip = screen.getByTestId("neighborhood-research-strip");
    expect(strip.textContent).toContain("Marista 6,8/10");
    expect(strip.textContent).toContain("Roubo 2,0× média");
    expect(strip.textContent).toContain("14 mil hab/km²");
    fireEvent.click(strip);
    expect(props.setExpandedId).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Pesquisa do bairro Funcionários" })).toBeTruthy();
  });
});

describe("PropertyCard — actions", () => {
  it("wires favorite, map, chat, gallery and expand actions without expanding", () => {
    const props = buildProps();
    const { container } = render(<PropertyCard {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos" }));
    expect(props.toggleFavorite).toHaveBeenCalledWith(KEY);
    fireEvent.click(screen.getByRole("button", { name: "stub-favoritar" }));
    expect(props.toggleFavorite).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: /Galeria \(8\)/ }));
    expect(props.setGalleryState).toHaveBeenCalledWith(
      expect.objectContaining({ initialIndex: 0 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "stub-galeria" }));
    expect(props.setGalleryState).toHaveBeenCalledWith(
      expect.objectContaining({ initialIndex: 2 }),
    );

    // Icon-only map button (a0e91e0): accessible name is "Ver no mapa".
    fireEvent.click(screen.getByRole("button", { name: /Ver no mapa/ }));
    expect(props.setViewMode).toHaveBeenCalledWith("split");
    expect(props.setSelectedMapPropertyKey).toHaveBeenCalledWith(KEY);

    fireEvent.click(screen.getByRole("button", { name: /Perguntar/ }));
    expect(props.openChatForProperty).toHaveBeenCalledWith(KEY, false);

    // All action buttons stop propagation: the card itself never expanded.
    expect(props.setExpandedId).not.toHaveBeenCalled();

    // The redundant Detalhes button was dropped (0551d19): the card
    // article click itself expands.
    fireEvent.click(container.querySelector("article") as HTMLElement);
    expect(props.setExpandedId).toHaveBeenCalledWith(KEY);
  });

  it("toggles expansion from the article click and tracks hover", () => {
    const props = buildProps();
    const { container } = render(<PropertyCard {...props} />);
    const article = container.querySelector("article") as HTMLElement;

    fireEvent.mouseEnter(article);
    expect(props.setHoveredPropertyKey).toHaveBeenCalledWith(KEY);
    fireEvent.mouseLeave(article);
    const hoverArg = (props.setHoveredPropertyKey as ReturnType<typeof vi.fn>).mock
      .calls.at(-1)?.[0] as (prev: string | null) => string | null;
    expect(typeof hoverArg).toBe("function");
    expect(hoverArg(KEY)).toBeNull();
    expect(hoverArg("other:9")).toBe("other:9");

    fireEvent.click(article);
    expect(props.setExpandedId).toHaveBeenCalledWith(KEY);
  });

  it("collapses when clicking an expanded card's article", () => {
    const props = buildProps({ isExpanded: true });
    const { container } = render(<PropertyCard {...props} />);
    const article = container.querySelector("article") as HTMLElement;

    // The Menos button was dropped with Detalhes (0551d19): clicking the
    // expanded card's article toggles it closed.
    fireEvent.click(article);
    expect(props.setExpandedId).toHaveBeenCalledWith(null);
  });

  it("folds the chat thread into the Perguntar button and opens the thread on click", () => {
    const props = buildProps({ qaList: [makeQaItem()] });
    render(<PropertyCard {...props} />);

    // The full-width chat strip is gone (10e9cac): no "Ver N msg" badge.
    expect(screen.queryByText(/Ver 1 msg no Chat/)).toBeNull();
    const perguntar = screen.getByRole("button", {
      name: "Abrir conversa deste imóvel (1 mensagem)",
    });
    // Count badge folded into the button, next to the label.
    expect(perguntar.textContent).toContain("Perguntar");
    expect(perguntar.textContent).toContain("1");
    // Last question + answer preview now live in the button tooltip.
    expect(perguntar.getAttribute("title")).toBe(
      "Vale a pena? — Sim, vale pelo custo-benefício.",
    );
    // An answered thread has no pending (amber pulsing) dot.
    expect(perguntar.querySelector("span.bg-amber-500")).toBeNull();

    fireEvent.click(perguntar);
    expect(props.openChatForProperty).toHaveBeenCalledWith(KEY, true);
    // The button stops propagation: clicking it must not expand the card.
    expect(props.setExpandedId).not.toHaveBeenCalled();
  });

  it("flags a pending question with a pulsing dot and an analysing tooltip on Perguntar", () => {
    const props = buildProps({
      qaList: [makeQaItem({ status: "pending", answer: null, answeredAt: null })],
    });
    render(<PropertyCard {...props} />);

    const perguntar = screen.getByRole("button", {
      name: "Abrir conversa deste imóvel (1 mensagem)",
    });
    expect(perguntar.textContent).toContain("Perguntar");
    expect(perguntar.textContent).toContain("1");
    // Pending preview moved to the tooltip: "<question> (analisando…)".
    expect(perguntar.getAttribute("title")).toBe("Vale a pena? (analisando…)");
    // Pulsing amber dot marks the pending answer.
    const dot = perguntar.querySelector("span.bg-amber-500.animate-pulse");
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("PropertyCard — expanded drawer", () => {
  it("renders analysis, breakdown, photos, description and feature grids", () => {
    const props = buildProps({ isExpanded: true });
    const { container } = render(<PropertyCard {...props} />);

    expect(screen.getByText("Análise & Trade-offs da Escolha")).toBeTruthy();
    expect(screen.getByText("Narrativa completa do imóvel.")).toBeTruthy();
    expect(screen.getByText("Bairro: +10")).toBeTruthy();
    expect(screen.getByText("Modernidade: +10")).toBeTruthy();
    expect(screen.getByText("Memória de cálculo detalhada.")).toBeTruthy();
    expect(screen.getByText(/Fotos Internas Raspadas \(3 fotos/)).toBeTruthy();
    expect(screen.getByText("Descrição Original do Anúncio")).toBeTruthy();
    expect(screen.getByText("Descrição curta do anúncio")).toBeTruthy();
    expect(screen.getByText("Conforto, Luz & Praticidade")).toBeTruthy();
    expect(screen.getByText("Closet planejado")).toBeTruthy();
    expect(screen.getByText("Condomínio & Instalações")).toBeTruthy();
    expect(screen.getByText("Elevador")).toBeTruthy();
    expect(screen.getByText("Pontos Próximos (1)")).toBeTruthy();
    expect(screen.getByText("Parque Municipal")).toBeTruthy();
    expect(container.textContent).toContain("Abrir Galeria em Tela Cheia (8)");

    fireEvent.click(screen.getByRole("button", { name: /Quarto/ }));
    expect(props.setGalleryState).toHaveBeenCalledWith(
      expect.objectContaining({ initialIndex: 1 }),
    );
  });

  it("prefers extra photos/description and offers the full-gallery overflow button", () => {
    const extraPhotos = Array.from({ length: 13 }, (_, i) => ({
      room: `Foto extra ${i + 1}`,
      url: `https://example.com/extra-${i}.jpg`,
    }));
    const props = buildProps({
      isExpanded: true,
      extraPhotos,
      extraDescription: "Descrição completa vinda dos detalhes",
      prop: makeProperty({ photosCount: 13 }),
    });
    render(<PropertyCard {...props} />);

    expect(screen.getByText(/Fotos Internas Raspadas \(13 fotos/)).toBeTruthy();
    expect(screen.getByText("Descrição completa vinda dos detalhes")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Ver todas as 13 fotos/ }),
    );
    expect(props.setGalleryState).toHaveBeenCalledWith(
      expect.objectContaining({ initialIndex: 12 }),
    );
  });

  it("omits photo and feature sections when the listing has none", () => {
    const props = buildProps({
      isExpanded: true,
      prop: makeProperty({
        samplePhotos: [],
        photosCount: 0,
        description: null,
        generatedDescription: null,
        installations: [],
        comfortCommodities: [],
        practicalityCommodities: [],
        amenities: [],
        placesNearby: [],
        narrativeJustification: "",
        detailedJustification: "",
      }),
    });
    render(<PropertyCard {...props} />);

    expect(screen.queryByText(/Fotos Internas Raspadas/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Galeria \(/ })).toBeNull();
    expect(screen.queryByText("Conforto, Luz & Praticidade")).toBeNull();
    expect(screen.queryByText(/Descrição Original do Anúncio/)).toBeNull();
    expect(screen.getByText("Carregando análise completa…")).toBeTruthy();
  });
});
