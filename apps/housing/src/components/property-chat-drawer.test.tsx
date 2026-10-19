// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GENERAL_THREAD_KEY,
  PropertyChatDrawer,
  type PropertyChatDrawerProps,
} from "./property-chat-drawer";
import type {
  EvaluatedProperty,
  PropertyQuestionItem,
} from "@/types/housing";

// Thumbnail helpers come from the photo showcase (network/photo boundary);
// stub them as pure pass-throughs. The drawer itself is never mocked.
vi.mock("@/components/property-photo-showcase", () => ({
  getThumbPhotoUrl: (url: string) => url,
  handleImgError: vi.fn(),
}));

const KEY = "quintoandar:1";
const NOW = () => new Date().toISOString();

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
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 8,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    description: "Descrição curta",
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
      greenTags: [],
      redTags: [],
      warningTags: [],
    },
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "Bom imóvel",
    narrativeJustification: "Narrativa",
    detailedJustification: "Detalhes",
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
    answerSource: "llm",
    createdAt: NOW(),
    answeredAt: NOW(),
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
      thumbnailUrl: "https://example.com/thumb.jpg",
    },
    ...overrides,
  };
}

function buildProps(
  overrides: Partial<PropertyChatDrawerProps> = {},
): PropertyChatDrawerProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    qaItems: [],
    activeThreadKey: null,
    pinnedProperty: null,
    onSelectThread: vi.fn(),
    onFocusProperty: vi.fn(),
    onSubmitQuestion: vi.fn().mockResolvedValue(true),
    onDeleteQuestion: vi.fn().mockResolvedValue(undefined),
    onClearHistory: vi.fn().mockResolvedValue(undefined),
    isSubmitting: false,
    filteredCount: 5,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
  Element.prototype.scrollTo = vi.fn() as never;
  HTMLElement.prototype.scrollIntoView = vi.fn() as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("PropertyChatDrawer — launcher and empty states", () => {
  it("renders the launcher when closed and opens on click", () => {
    const props = buildProps({ open: false });
    const { container } = render(<PropertyChatDrawer {...props} />);

    const launcher = screen.getByRole("button", {
      name: /Abrir assistente de imóveis/,
    });
    expect(container.querySelector("aside")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    fireEvent.click(launcher);
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it("shows the all-threads empty state when open", () => {
    render(<PropertyChatDrawer {...buildProps()} />);

    expect(
      screen.getByRole("heading", { name: "Assistente de imóveis" }),
    ).toBeTruthy();
    expect(screen.getByText("Nenhuma conversa ainda")).toBeTruthy();
    expect(screen.getByText(/5 imóveis filtrados/)).toBeTruthy();
    // Quick-question chips were removed from the composer (4c23bbb).
    expect(
      screen.queryByRole("button", {
        name: "Quais os melhores apês do ranking agora?",
      }),
    ).toBeNull();
    expect(
      screen.getByPlaceholderText("Pergunte sobre os imóveis da tela…"),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Enviar mensagem" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /Todas/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByText("Resposta instantânea + análise detalhada da sessão Cursor"),
    ).toBeTruthy();
  });

  it("shows the general-thread empty state", () => {
    render(
      <PropertyChatDrawer
        {...buildProps({ activeThreadKey: GENERAL_THREAD_KEY })}
      />,
    );
    expect(screen.getByText("Pergunte sobre o ranking geral")).toBeTruthy();
  });
});

describe("PropertyChatDrawer — message timeline", () => {
  it("renders answered, pending and instant messages with source labels and chips", () => {
    const items = [
      makeQaItem({ id: "qa-1" }),
      makeQaItem({
        id: "qa-2",
        question: "Tem vaga?",
        status: "pending",
        answer: null,
        answeredAt: null,
        answerSource: undefined,
      }),
      makeQaItem({
        id: "qa-3",
        propertyKey: GENERAL_THREAD_KEY,
        question: "Qual o melhor bairro?",
        answer: "Funcionários lidera o ranking.",
        answerSource: "instant_diagnostic",
      }),
    ];
    render(<PropertyChatDrawer {...buildProps({ qaItems: items })} />);

    expect(screen.getByText("Vale a pena?")).toBeTruthy();
    expect(screen.getByText("Sim, vale pelo custo-benefício.")).toBeTruthy();
    expect(
      screen.getByText("Resposta rápida · IA com dados do portal"),
    ).toBeTruthy();
    expect(
      screen.getByText("Resposta instantânea · dados do portal"),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Consultando os dados do imóvel…",
    );
    // Property chip only appears in the all-threads view (both property items).
    expect(
      screen.getAllByRole("button", { name: /Funcionários \(BH\) · Rua de Teste/ }),
    ).toHaveLength(2);
    // Delete is offered for answered messages (2), not for the pending one.
    expect(
      screen.getAllByRole("button", { name: "Excluir pergunta e resposta" }),
    ).toHaveLength(2);
    expect(screen.getByText("Qual o melhor bairro?")).toBeTruthy();
  });

  it("filters the timeline to the active property thread and shows its context header", () => {
    const pinned = makeProperty({ eligible: false, exclusionReason: "Área pequena" });
    const items = [
      makeQaItem({ id: "qa-1" }),
      makeQaItem({
        id: "qa-2",
        propertyKey: GENERAL_THREAD_KEY,
        question: "Pergunta geral secreta",
        answer: "Resposta geral.",
      }),
    ];
    const props = buildProps({
      qaItems: items,
      activeThreadKey: KEY,
      pinnedProperty: pinned,
    });
    const { container } = render(<PropertyChatDrawer {...props} />);

    expect(screen.getByText("Vale a pena?")).toBeTruthy();
    expect(screen.queryByText("Pergunta geral secreta")).toBeNull();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("Retido")).toBeTruthy();
    expect(container.textContent).toContain("Funcionários (BH)");
    expect(container.textContent).toContain("Rua de Teste");
    expect(container.textContent).toContain("R$ 3.100");
    expect(container.textContent).toContain("88.5 pts");
    expect(
      screen.getByPlaceholderText("Pergunte sobre Funcionários (BH)…"),
    ).toBeTruthy();
    // Quick-question chips were removed from the composer (4c23bbb).
    expect(
      screen.queryByRole("button", { name: "Por que esse foi retido?" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar este imóvel na lista" }),
    );
    expect(props.onFocusProperty).toHaveBeenCalledWith(KEY);
    expect(
      (screen.getByRole("link", { name: "Abrir anúncio original" }) as HTMLAnchorElement)
        .href,
    ).toBe("https://example.com/imovel/1");
  });

  it("derives the property context from the snapshot when nothing is pinned", () => {
    const props = buildProps({
      qaItems: [makeQaItem()],
      activeThreadKey: KEY,
      pinnedProperty: null,
    });
    const { container } = render(<PropertyChatDrawer {...props} />);
    expect(container.textContent).toContain("Funcionários (BH)");
    expect(container.textContent).toContain("R$ 3.100");
    expect(screen.queryByText("#1")).toBeNull();
  });

  it("switches threads from the nav pills and the message property chip", () => {
    const items = [
      makeQaItem({ id: "qa-1" }),
      makeQaItem({ id: "qa-2", propertyKey: GENERAL_THREAD_KEY, question: "Geral?" }),
    ];
    const props = buildProps({ qaItems: items });
    render(<PropertyChatDrawer {...props} />);
    const nav = within(
      document.querySelector('nav[aria-label="Conversas"]') as HTMLElement,
    );

    fireEvent.click(nav.getByRole("button", { name: /Todas/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(null);

    fireEvent.click(nav.getByRole("button", { name: "Geral" }));
    expect(props.onSelectThread).toHaveBeenCalledWith(GENERAL_THREAD_KEY);

    fireEvent.click(nav.getByRole("button", { name: /Funcionários/ }));
    expect(props.onSelectThread).toHaveBeenCalledWith(KEY);

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Funcionários \(BH\) · Rua de Teste/,
      })[0] as HTMLElement,
    );
    expect(props.onSelectThread).toHaveBeenCalledWith(KEY);
  });

  it("shows detailed answers with the original instant answer and awaiting banner", () => {
    localStorage.setItem("housing-chat-seen-answers", JSON.stringify([]));
    const items = [
      makeQaItem({
        id: "qa-detailed",
        question: "Análise completa?",
        answer: "Análise detalhada final.",
        instantAnswer: "Resposta instantânea original aqui.",
        answerSource: "cursor_session",
      }),
      makeQaItem({
        id: "qa-awaiting",
        question: "E a segurança?",
        answer: "Resposta parcial rápida.",
        answerSource: "instant_diagnostic",
        awaitingDetailedAnswer: true,
      }),
    ];
    render(<PropertyChatDrawer {...buildProps({ qaItems: items })} />);

    expect(
      screen.getByText("Análise completa · sessão Cursor"),
    ).toBeTruthy();
    expect(screen.getByText("Análise detalhada final.")).toBeTruthy();
    expect(screen.getByText("Ver resposta instantânea original")).toBeTruthy();
    expect(
      screen.getByText("Resposta instantânea original aqui."),
    ).toBeTruthy();
    expect(screen.getByText("nova")).toBeTruthy();
    expect(screen.getByText(/1 análise detalhada em andamento/)).toBeTruthy();
    expect(
      screen.getByText(/Analisando em detalhe na sessão do Cursor/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Abrir assistente de imóveis \(1 novas respostas\)/ }),
    ).toBeTruthy();
  });
});

describe("PropertyChatDrawer — composer and history actions", () => {
  it("submits typed questions via the send button and Enter", async () => {
    const props = buildProps();
    render(<PropertyChatDrawer {...props} />);
    const textarea = screen.getByLabelText("Mensagem") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "  Tem AC?  " } });
    expect(
      (screen.getByRole("button", { name: "Enviar mensagem" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    });
    expect(props.onSubmitQuestion).toHaveBeenCalledWith({
      question: "Tem AC?",
      property: null,
    });
    expect(textarea.value).toBe("");

    fireEvent.change(textarea, { target: { value: "E a vaga?" } });
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter" });
    });
    expect(props.onSubmitQuestion).toHaveBeenCalledWith({
      question: "E a vaga?",
      property: null,
    });

    // Shift+Enter only breaks the line.
    fireEvent.change(textarea, { target: { value: "Não enviar" } });
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    });
    expect(props.onSubmitQuestion).toHaveBeenCalledTimes(2);
  });

  it("passes the pinned property when submitting from a property thread", async () => {
    const pinned = makeProperty();
    const props = buildProps({ activeThreadKey: KEY, pinnedProperty: pinned });
    render(<PropertyChatDrawer {...props} />);
    const textarea = screen.getByLabelText("Mensagem") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Essa área é segura?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    });
    expect(props.onSubmitQuestion).toHaveBeenCalledWith({
      question: "Essa área é segura?",
      property: pinned,
    });
  });

  it("restores the draft and offers a retry after a failed submit", async () => {
    const onSubmitQuestion = vi
      .fn()
      .mockRejectedValueOnce(new Error("Falha QA"))
      .mockResolvedValue(true);
    const props = buildProps({ onSubmitQuestion });
    render(<PropertyChatDrawer {...props} />);
    const textarea = screen.getByLabelText("Mensagem") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Pergunta difícil" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    });

    expect(screen.getByRole("alert").textContent).toContain("Falha QA");
    expect(screen.getByRole("alert").textContent).toContain(
      "Seu texto foi mantido.",
    );
    expect(textarea.value).toBe("Pergunta difícil");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    });
    expect(onSubmitQuestion).toHaveBeenCalledTimes(2);
    expect(onSubmitQuestion).toHaveBeenLastCalledWith({
      question: "Pergunta difícil",
      property: null,
    });
  });

  it("treats a false submit result as an error and keeps the draft", async () => {
    const props = buildProps({
      onSubmitQuestion: vi.fn().mockResolvedValue(false),
    });
    render(<PropertyChatDrawer {...props} />);
    const textarea = screen.getByLabelText("Mensagem") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Oi?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível enviar sua pergunta.",
    );
    expect(textarea.value).toBe("Oi?");
  });

  it("deletes a message and clears history after a two-step confirm", async () => {
    const props = buildProps({ qaItems: [makeQaItem()] });
    render(<PropertyChatDrawer {...props} />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Excluir pergunta e resposta" }),
      );
    });
    expect(props.onDeleteQuestion).toHaveBeenCalledWith("qa-1");

    const clearButton = screen.getByTitle("Apagar todo o histórico");
    fireEvent.click(clearButton);
    expect(screen.getByText("Apagar tudo?")).toBeTruthy();
    expect(props.onClearHistory).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(clearButton);
    });
    expect(props.onClearHistory).toHaveBeenCalledTimes(1);
  });

  it("copies an answer to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<PropertyChatDrawer {...buildProps({ qaItems: [makeQaItem()] })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar resposta" }));
    });
    expect(writeText).toHaveBeenCalledWith("Sim, vale pelo custo-benefício.");
    expect(screen.getByText("Copiado")).toBeTruthy();
  });

  it("shows optimistic typing while submitting without a pending item", () => {
    render(<PropertyChatDrawer {...buildProps({ isSubmitting: true })} />);
    expect(screen.getByRole("status").textContent).toContain("Enviando…");
    expect(
      (screen.getByRole("button", { name: "Enviar mensagem" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("PropertyChatDrawer — closing and scroll target", () => {
  it("closes via the X button, Escape and toggles with Cmd+J", () => {
    const props = buildProps();
    render(<PropertyChatDrawer {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar assistente" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("consumes the scroll target when opened for a property", () => {
    const onConsumeScrollTarget = vi.fn();
    render(
      <PropertyChatDrawer
        {...buildProps({
          qaItems: [makeQaItem()],
          scrollTargetPropertyKey: KEY,
          onConsumeScrollTarget,
        })}
      />,
    );
    expect(onConsumeScrollTarget).toHaveBeenCalled();
  });
});
