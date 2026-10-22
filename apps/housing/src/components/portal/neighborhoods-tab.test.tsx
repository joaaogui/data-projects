// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NeighborhoodsTab } from "./neighborhoods-tab";
import type { PortalController } from "./use-portal-controller";
import type { ReferenceNeighborhoodRow } from "@/lib/reference-neighborhood";
import { DEFAULT_WEIGHTS } from "@/lib/scoring-engine";
import type { ComputedNeighborhood } from "@/types/housing";
import type { NeighborhoodResearchSummary } from "@/types/neighborhood-research";

function makeNeighborhood(
  overrides: Partial<ComputedNeighborhood> = {},
): ComputedNeighborhood {
  return {
    cityCode: "BH",
    cityName: "Belo Horizonte",
    neighborhood: "Funcionários",
    overallPosition: 1,
    cityPosition: 1,
    baseScore: 9.6,
    idhm: 0.956,
    commuteTime: "10 min",
    nubankHub: "Santa Efigênia",
    urbanBreathingScore: 9.5,
    commuteLogisticsScore: 9.8,
    buildingStockFitScore: 9.4,
    budgetFitScore: 9.5,
    safetyCarScore: 9.6,
    shortRationale: "Perto do escritório.",
    detailedJustification: "Nota 9.60/10 (base): A 10 min do Nubank.",
    pros: ["Perto"],
    cons: [],
    dynamicScore: 9.61,
    dynamicOverallRank: 1,
    dynamicCityRank: 1,
    dynamicJustification: "Memória dinâmica",
    ...overrides,
  };
}

const BH = makeNeighborhood();
const SP = makeNeighborhood({
  cityCode: "SP",
  cityName: "São Paulo",
  neighborhood: "Pinheiros",
  overallPosition: 5,
  dynamicOverallRank: 2,
  dynamicScore: 9.0,
  shortRationale: "Bem servido.",
  detailedJustification: "Metrô perto.",
});

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  const ranking = overrides.neighborhoodRanking ?? [BH, SP];
  return {
    activeTab: "neighborhoods",
    neighborhoodRanking: ranking,
    dynamicNeighborhoods: ranking.filter((n) => !n.isExtra),
    referenceNeighborhoods: [],
    neighborhoodResearch: {},
    weights: DEFAULT_WEIGHTS,
    selectedCities: [],
    setActiveTab: vi.fn(),
    setSelectedCities: vi.fn(),
    setSelectedNeighborhoods: vi.fn(),
    ...overrides,
  } as unknown as PortalController;
}

describe("NeighborhoodsTab", () => {
  it("renders nothing outside the neighborhoods tab", () => {
    const { container } = render(
      <NeighborhoodsTab ctl={buildCtl({ activeTab: "properties" })} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders neighborhoods in both mobile cards and the desktop table", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    // Both layouts render in jsdom (visibility is CSS-only)
    expect(screen.getAllByText("Funcionários").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Pinheiros").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("9.61/10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Perto do escritório\./).length).toBeGreaterThanOrEqual(1);
    // The "Nota X/10 (...):" prefix is stripped from the detailed text
    expect(screen.getAllByText("A 10 min do Nubank.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Memória dinâmica").length).toBeGreaterThanOrEqual(1);
    // Rank improvement for SP: overall 5 -> dynamic 2 = +3
    expect(screen.getAllByText("(+3)").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by the selected cities", () => {
    render(
      <NeighborhoodsTab ctl={buildCtl({ selectedCities: ["SP"] })} />,
    );
    expect(screen.getAllByText("Pinheiros").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Funcionários")).toBeNull();
  });

  it("shows an empty section when no neighborhood matches", () => {
    const { container } = render(
      <NeighborhoodsTab
        ctl={buildCtl({ selectedCities: ["RJ"], neighborhoodRanking: [BH] })}
      />,
    );
    expect(screen.queryByText("Funcionários")).toBeNull();
    expect(container.querySelector("tbody")?.textContent).toBe("");
  });

  it("clicking a neighborhood selects its city/neighborhood and jumps to properties", () => {
    const ctl = buildCtl();
    render(<NeighborhoodsTab ctl={ctl} />);
    // First match is the mobile card button
    fireEvent.click(screen.getAllByText("Funcionários")[0]!);
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["BH"]);
    expect(ctl.setSelectedNeighborhoods).toHaveBeenCalledWith([
      "BH:Funcionários",
    ]);
    expect(ctl.setActiveTab).toHaveBeenCalledWith("properties");
  });

  it("clicking the desktop-table neighborhood also navigates to properties", () => {
    const ctl = buildCtl();
    render(<NeighborhoodsTab ctl={ctl} />);
    const buttons = screen.getAllByText("Pinheiros");
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["SP"]);
    expect(ctl.setSelectedNeighborhoods).toHaveBeenCalledWith([
      "SP:Pinheiros",
    ]);
    expect(ctl.setActiveTab).toHaveBeenCalledWith("properties");
  });

  it("shows a negative rank diff in the table", () => {
    render(
      <NeighborhoodsTab
        ctl={buildCtl({
          neighborhoodRanking: [
            makeNeighborhood({ overallPosition: 1, dynamicOverallRank: 4 }),
          ],
        })}
      />,
    );
    expect(screen.getAllByText("(-3)").length).toBeGreaterThanOrEqual(1);
  });
});

describe("NeighborhoodsTab top 20", () => {
  const ranking = Array.from({ length: 25 }, (_, i) =>
    makeNeighborhood({
      neighborhood: `Bairro ${i + 1}`,
      dynamicOverallRank: i + 1,
      overallPosition: i < 10 ? i + 1 : 30 + i,
      dynamicScore: Math.round((9.5 - i * 0.1) * 100) / 100,
      ...(i >= 10
        ? {
            isExtra: true as const,
            shortRationale: `Resumo do extra ${i + 1}.`,
            detailedJustification: `Dossiê do extra ${i + 1}.`,
          }
        : {}),
    }),
  );

  it("shows the first 20 rows of the ranking plus the reference, which takes a rank and shifts the rows below", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ neighborhoodRanking: ranking, referenceNeighborhoods: [REF] })} />);
    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(21);
    const refIdx = rows.findIndex((r) => r.getAttribute("data-testid") === "reference-neighborhood-row");
    // 9.3 sits below Bairro 1–3 (9.5, 9.4, 9.3: ties stay above it)
    expect(refIdx).toBe(3);
    expect(rows[refIdx]!.textContent).toContain("#4");
    expect(rows[refIdx + 1]!.textContent).toContain("Bairro 4");
    expect(rows[refIdx + 1]!.textContent).toContain("#5");
    expect(rows.at(-1)!.textContent).toContain("Bairro 20");
    expect(rows.at(-1)!.textContent).toContain("#21");
    expect(screen.queryByText("Bairro 21")).toBeNull();
  });

  it("caps at 20 after the city filter", () => {
    const mixed = [...ranking.slice(0, 15), ...ranking.slice(15).map((n) => ({ ...n, cityCode: "RJ" as const }))];
    render(<NeighborhoodsTab ctl={buildCtl({ neighborhoodRanking: mixed, selectedCities: ["RJ"] })} />);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(10);
  });

  it("marks extra rows with a plain-words badge and no rank diff, and shows their rationale like catalog rows", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ neighborhoodRanking: ranking })} />);
    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows[0]!.querySelector('[data-testid="extra-neighborhood-badge"]')).toBeNull();
    const extra = rows[10]!;
    const badge = extra.querySelector('[data-testid="extra-neighborhood-badge"]')!;
    expect(badge.textContent).toBe("extra");
    expect(badge.getAttribute("title")).toBe("Bairro pesquisado fora da lista original");
    expect(extra.textContent).toContain("#11");
    expect(extra.textContent).not.toMatch(/\([+-]\d+\)/);
    expect(extra.textContent).toContain("Resumo do extra 11.");
    expect(extra.textContent).toContain("Dossiê do extra 11.");
    // Same markup as a catalog row: bold one-liner, then the detailed text, then the calculation details
    const cell = extra.querySelector("td:last-child")!;
    expect(cell.querySelector("p.font-medium")?.textContent).toBe("Resumo do extra 11.");
    expect(cell.querySelector("details")).not.toBeNull();
    // Mobile cards carry the badge and the rationale too: 10 extras in the top 20
    expect(document.querySelectorAll("article [data-testid='extra-neighborhood-badge']")).toHaveLength(10);
    expect(screen.getAllByText("Dossiê do extra 11.")).toHaveLength(2);
  });

  it("never shows the old out-of-catalog note", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ neighborhoodRanking: ranking, referenceNeighborhoods: [REF] })} />);
    expect(document.body.textContent).not.toContain("Bairro fora do catálogo");
    expect(document.body.textContent).not.toContain("calibração do motor");
  });

  it("computes catalog rank diffs against the catalog-only ranking, not the combined one", () => {
    const extra = makeNeighborhood({ neighborhood: "Extra", dynamicOverallRank: 1, overallPosition: 30, isExtra: true });
    const catalogRow = makeNeighborhood({ overallPosition: 1, dynamicOverallRank: 2 });
    render(
      <NeighborhoodsTab
        ctl={buildCtl({
          neighborhoodRanking: [extra, catalogRow],
          dynamicNeighborhoods: [{ ...catalogRow, dynamicOverallRank: 1 }],
        })}
      />,
    );
    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows[1]!.textContent).toContain("#2");
    expect(rows.some((r) => /\([+-]\d+\)/.test(r.textContent ?? ""))).toBe(false);
  });
});

const REF: ReferenceNeighborhoodRow = {
  key: "GO:Setor Marista",
  neighborhood: "Setor Marista",
  dynamicScore: 9.3,
  urbanBreathingScore: 8.6,
  commuteLogisticsScore: 7.5,
  safetyCarScore: 8.5,
  shortRationale: "Bairro de referência.",
  detailedJustification: "Plano e de torres espaçadas.",
};

function summary(overrides: Partial<NeighborhoodResearchSummary>): NeighborhoodResearchSummary {
  return {
    key: "BH:Funcionários",
    marista: 6.68,
    maristaSource: "rubric",
    robberyRatio: null,
    densityPerKm2: 13869,
    apartmentsShare: 99,
    highlight: null,
    redFlag: null,
    ...overrides,
  };
}

describe("NeighborhoodsTab reference row", () => {
  it("ranks Setor Marista between the rows scoring above and below it, renumbering the rows below", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF] })} />);
    const bodyRows = [...document.querySelectorAll("tbody tr")];
    expect(bodyRows).toHaveLength(3);
    expect(bodyRows[0]!.textContent).toContain("Funcionários");
    expect(bodyRows[1]!.getAttribute("data-testid")).toBe("reference-neighborhood-row");
    expect(bodyRows[2]!.textContent).toContain("Pinheiros");
    // The reference takes #2 next to its badge; Pinheiros moves to #3 but keeps its catalog-only diff (5 -> 2 = +3)
    expect(bodyRows[0]!.textContent).toContain("#1");
    expect(bodyRows[1]!.textContent).toContain("#2");
    expect(bodyRows[2]!.textContent).toContain("#3");
    expect(bodyRows[2]!.textContent).toContain("(+3)");
    expect(bodyRows[1]!.textContent).toContain("Referência");
    expect(bodyRows[1]!.textContent).toContain("neutro");
    expect(bodyRows[1]!.textContent).not.toMatch(/\([+-]\d+\)/);
    expect(screen.getAllByText("Seu bairro de referência — fora do catálogo, não altera as notas dos imóveis")).toHaveLength(2);
    expect(document.querySelector("[data-testid='reference-neighborhood-card']")!.textContent).toContain("#2");
    const cards = [...document.querySelectorAll("article")];
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual([null, "reference-neighborhood-card", null]);
  });

  it("goes last when it scores below every visible row and is hidden without rows", () => {
    const low = { ...REF, dynamicScore: 5 };
    const { unmount } = render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [low] })} />);
    const bodyRows = [...document.querySelectorAll("tbody tr")];
    expect(bodyRows.at(-1)!.getAttribute("data-testid")).toBe("reference-neighborhood-row");
    unmount();
    render(
      <NeighborhoodsTab
        ctl={buildCtl({ referenceNeighborhoods: [REF], selectedCities: ["RJ"], neighborhoodRanking: [BH] })}
      />,
    );
    expect(screen.queryByTestId("reference-neighborhood-row")).toBeNull();
  });

  it("keeps the merged rank numbers under a city filter", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF], selectedCities: ["SP"] })} />);
    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows.map((r) => r.textContent!.match(/#\d+/)?.[0])).toEqual(["#2", "#3"]);
    expect(rows[0]!.getAttribute("data-testid")).toBe("reference-neighborhood-row");
    expect(rows[1]!.textContent).toContain("Pinheiros");
  });

  it("opens the research panel for GO:Setor Marista on click", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const ctl = buildCtl({ referenceNeighborhoods: [REF] });
      render(<NeighborhoodsTab ctl={ctl} />);
      fireEvent.click(screen.getByTestId("reference-neighborhood-row"));
      expect(screen.getByTestId("neighborhood-research-panel")).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/neighborhoods/${encodeURIComponent("GO:Setor Marista")}`,
        expect.anything(),
      );
      expect(ctl.setActiveTab).not.toHaveBeenCalled();
      expect(ctl.setSelectedCities).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows the reference's rationale under its subtitle in the table and the card", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF] })} />);
    const row = screen.getByTestId("reference-neighborhood-row");
    const card = screen.getByTestId("reference-neighborhood-card");
    for (const el of [row, card]) {
      expect(el.textContent).toContain("Bairro de referência.");
      expect(el.textContent).toContain("Plano e de torres espaçadas.");
    }
  });

  const AGUAS: ReferenceNeighborhoodRow = {
    ...REF,
    key: "BSB:Águas Claras",
    neighborhood: "Águas Claras",
    dynamicScore: 9.0,
    shortRationale: "Plano, de torres, com metrô.",
    detailedJustification: "Rua viva até tarde.",
  };

  it("shows each reference's own rationale", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF, AGUAS] })} />);
    const [marista, aguas] = screen.getAllByTestId("reference-neighborhood-row");
    expect(marista!.textContent).toContain("Bairro de referência.");
    expect(aguas!.textContent).toContain("Plano, de torres, com metrô.");
    expect(aguas!.textContent).not.toContain("Bairro de referência.");
  });

  it("ranks both references at their score positions, each with its own badge and subtitle", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF, AGUAS] })} />);
    const rows = [...document.querySelectorAll("tbody tr")];
    // Funcionários 9.61 > Marista 9.3 > Águas Claras 9.0 = Pinheiros 9.0 (ties stay above the reference)
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      null,
      "reference-neighborhood-row",
      null,
      "reference-neighborhood-row",
    ]);
    expect(rows.map((r) => r.textContent!.match(/#\d+/)?.[0])).toEqual(["#1", "#2", "#3", "#4"]);
    expect(rows[1]!.textContent).toContain("Setor Marista");
    expect(rows[1]!.textContent).toContain("Referência");
    expect(rows[3]!.textContent).toContain("Águas Claras");
    expect(rows[3]!.textContent).toContain("DF");
    expect(rows[3]!.textContent).toContain("Onde você mora hoje");
    expect(screen.getAllByText("Onde você mora hoje — fora do catálogo, não altera as notas dos imóveis")).toHaveLength(2);
    expect(screen.getAllByText("Seu bairro de referência — fora do catálogo, não altera as notas dos imóveis")).toHaveLength(2);
    expect(screen.getAllByTestId("reference-neighborhood-card")).toHaveLength(2);
  });

  it("keeps two references with the same score in a stable order", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF, { ...AGUAS, dynamicScore: 9.3 }] })} />);
    const refs = screen.getAllByTestId("reference-neighborhood-row").map((r) => r.textContent);
    expect(refs[0]).toContain("Setor Marista");
    expect(refs[1]).toContain("Águas Claras");
  });

  it("opens Águas Claras' dossier on click", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF, AGUAS] })} />);
      fireEvent.click(screen.getAllByTestId("reference-neighborhood-row")[1]!);
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/neighborhoods/${encodeURIComponent("BSB:Águas Claras")}`,
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("NeighborhoodsTab metric columns", () => {
  it("shows the three sub-scores with the current weights in the header tooltips", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ weights: { ...DEFAULT_WEIGHTS, safetyCarWeight: 1.5 } })} />);
    for (const label of ["Vida urbana", "Deslocamento", "Segurança"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeTruthy();
    }
    for (const label of ["Prédios", "Preço", "Aptos", "Marista"]) {
      expect(screen.queryByRole("columnheader", { name: label })).toBeNull();
    }
    expect(screen.getByRole("columnheader", { name: "Segurança" }).getAttribute("title")).toBe(
      "Segurança (0–10) · peso atual 1,5×",
    );
    expect(screen.getByRole("columnheader", { name: "Vida urbana" }).getAttribute("title")).toBe(
      "Vida urbana (0–10): nota pelos 9 critérios — densidade com prédios altos, relevo plano, gastronomia de rua, vida noturna, parque a até 1 km, arborização, segurança à noite, prédios modernos e calma. · peso atual 3,5×",
    );
    const funcionarios = document.querySelector("tbody tr")!;
    const cells = [...funcionarios.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells.slice(4, 7)).toEqual(["9.5", "9.8", "9.6"]);
  });

  it("never describes Vida urbana as similarity to Setor Marista", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhoods: [REF] })} />);
    const titles = screen.getAllByRole("columnheader").map((th) => th.getAttribute("title") ?? "");
    expect(titles.some((t) => /marista|semelhan/i.test(t))).toBe(false);
  });

  it("shows density from the research summary, with — otherwise", () => {
    render(
      <NeighborhoodsTab
        ctl={buildCtl({
          referenceNeighborhoods: [REF],
          neighborhoodResearch: {
            "BH:Funcionários": summary({}),
            "GO:Setor Marista": summary({ key: "GO:Setor Marista", marista: 8.03, densityPerKm2: 5061, apartmentsShare: 87.3 }),
          },
        })}
      />,
    );
    const [bh, ref, sp] = [...document.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent).slice(7, 8),
    );
    expect(bh).toEqual(["14 mil"]);
    expect(ref).toEqual(["5,1 mil"]);
    expect(sp).toEqual(["—"]);
  });

  it("hides the research metrics on mobile cards until 'Mais métricas' is pressed", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ neighborhoodResearch: { "BH:Funcionários": summary({}) } })} />);
    const firstCard = () => document.querySelector("article")!;
    expect(firstCard().textContent).not.toContain("Densid.");
    fireEvent.click(screen.getByRole("button", { name: "Mais métricas" }));
    expect(firstCard().textContent).toContain("Densid.");
    expect(firstCard().textContent).toContain("14 mil");
    expect(screen.getByRole("button", { name: "Menos métricas" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the research dossier panel directly from a catalog neighborhood's 📊 Dossiê button without leaving the tab", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const ctl = buildCtl({
        neighborhoodResearch: {
          "BH:Funcionários": summary({ key: "BH:Funcionários" }),
        },
      });
      render(<NeighborhoodsTab ctl={ctl} />);
      const dossierBtns = screen.getAllByRole("button", {
        name: "Abrir dossiê de Funcionários",
      });
      expect(dossierBtns.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(dossierBtns[dossierBtns.length - 1]!);
      expect(screen.getByTestId("neighborhood-research-panel")).toBeTruthy();
      expect(
        screen.getByRole("dialog", { name: "Pesquisa do bairro Funcionários" }),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/neighborhoods/${encodeURIComponent("BH:Funcionários")}`,
        expect.anything(),
      );
      expect(ctl.setActiveTab).not.toHaveBeenCalled();
      expect(ctl.setSelectedCities).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders active listing supply badge and weighted contribution + apartmentsShare tooltips on sub-score and density cells", () => {
    const ctl = buildCtl({
      availableNeighborhoodOptions: [
        { name: "Funcionários", count: 7, cityCode: "BH", score: 9.61 },
        { name: "Pinheiros", count: 1, cityCode: "SP", score: 9.0 },
      ],
      neighborhoodResearch: {
        "BH:Funcionários": summary({
          key: "BH:Funcionários",
          densityPerKm2: 13869,
          apartmentsShare: 99,
        }),
      },
    });
    render(<NeighborhoodsTab ctl={ctl} />);

    const supplyBadges = screen.getAllByTestId("neighborhood-supply-badge");
    expect(supplyBadges.map((b) => b.textContent)).toContain("7 imóveis");
    expect(supplyBadges.map((b) => b.textContent)).toContain("1 imóvel");

    const funcionariosRow = document.querySelector("tbody tr")!;
    const tds = [...funcionariosRow.querySelectorAll("td")];
    const urbanTd = tds[4]!;
    const commuteTd = tds[5]!;
    const safetyTd = tds[6]!;
    const densityTd = tds[7]!;

    expect(urbanTd.getAttribute("title")).toContain("Vida urbana: 9.5/10");
    expect(urbanTd.getAttribute("title")).toContain("Nota Dinâmica");
    expect(commuteTd.getAttribute("title")).toContain("Deslocamento: 9.8/10");
    expect(commuteTd.getAttribute("title")).toContain("Nota Dinâmica");
    expect(safetyTd.getAttribute("title")).toContain("Segurança: 9.6/10");
    expect(safetyTd.getAttribute("title")).toContain("Nota Dinâmica");
    expect(densityTd.getAttribute("title")).toContain("99% de apartamentos");
    expect(densityTd.getAttribute("title")).toContain("Nota Dinâmica");
  });
});

describe("NeighborhoodsTab sorting", () => {
  // Score ranks: Funcionários #1 (9.61), Setor Marista #2 (9.3), Pinheiros #3 (9.0), Botafogo #4 (8.0)
  const FUNC = makeNeighborhood({ commuteTime: "9-25 min", urbanBreathingScore: 9.5, commuteLogisticsScore: 9.8 });
  const PIN = makeNeighborhood({
    cityCode: "SP",
    neighborhood: "Pinheiros",
    dynamicScore: 9.0,
    commuteTime: "15 min",
    urbanBreathingScore: 7.0,
    commuteLogisticsScore: 8.5,
  });
  const BOT = makeNeighborhood({
    cityCode: "RJ",
    neighborhood: "Botafogo",
    dynamicScore: 8.0,
    commuteTime: "10-15 min",
    urbanBreathingScore: 8.0,
    commuteLogisticsScore: 9.0,
  });
  const ctl = () =>
    buildCtl({
      neighborhoodRanking: [FUNC, PIN, BOT],
      referenceNeighborhoods: [REF],
      neighborhoodResearch: {
        "BH:Funcionários": summary({}),
        "RJ:Botafogo": summary({ key: "RJ:Botafogo", densityPerKm2: 9000 }),
        "GO:Setor Marista": summary({ key: "GO:Setor Marista", densityPerKm2: 5061 }),
      },
    });
  const tableNames = () =>
    [...document.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td:nth-child(3) button")!.textContent!);
  const tableRanks = () => [...document.querySelectorAll("tbody tr")].map((tr) => tr.textContent!.match(/#\d+/)?.[0]);
  const header = (label: string) => screen.getByRole("columnheader", { name: label });
  const clickHeader = (label: string) => fireEvent.click(within(header(label)).getByRole("button"));

  it("defaults to score descending, with aria-sort and ▼ on that header only", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    expect(tableNames()).toEqual(["Funcionários", "Setor Marista", "Pinheiros", "Botafogo"]);
    expect(header("Nota Dinâmica").getAttribute("aria-sort")).toBe("descending");
    expect(header("Nota Dinâmica").textContent).toContain("▼");
    const others = screen.getAllByRole("columnheader").filter((th) => th !== header("Nota Dinâmica"));
    expect(others.every((th) => th.getAttribute("aria-sort") === "none")).toBe(true);
  });

  it("makes every column header a sort button", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(18);
    for (const th of headers) expect(within(th).getByRole("button")).toBeTruthy();
  });

  it("sorts text columns ascending first, toggles on a second click and keeps the score rank numbers", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    clickHeader("Bairro");
    expect(tableNames()).toEqual(["Botafogo", "Funcionários", "Pinheiros", "Setor Marista"]);
    expect(tableRanks()).toEqual(["#4", "#1", "#3", "#2"]);
    expect(header("Bairro").getAttribute("aria-sort")).toBe("ascending");
    expect(header("Bairro").textContent).toContain("▲");
    expect(header("Nota Dinâmica").getAttribute("aria-sort")).toBe("none");
    clickHeader("Bairro");
    expect(tableNames()).toEqual(["Setor Marista", "Pinheiros", "Funcionários", "Botafogo"]);
    expect(header("Bairro").getAttribute("aria-sort")).toBe("descending");
  });

  it("sorts by city badge, the reference included", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    clickHeader("Cidade");
    // BH, GO, RJ, SP
    expect(tableNames()).toEqual(["Funcionários", "Setor Marista", "Botafogo", "Pinheiros"]);
  });

  it("sorts numeric columns descending first and the reference like any row", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    clickHeader("Vida urbana");
    expect(tableNames()).toEqual(["Funcionários", "Setor Marista", "Botafogo", "Pinheiros"]);
    clickHeader("Vida urbana");
    expect(tableNames()).toEqual(["Pinheiros", "Botafogo", "Setor Marista", "Funcionários"]);
  });

  it("puts rows without a value last in both directions", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    clickHeader("Densidade");
    expect(tableNames()).toEqual(["Funcionários", "Botafogo", "Setor Marista", "Pinheiros"]);
    clickHeader("Densidade");
    expect(tableNames()).toEqual(["Setor Marista", "Botafogo", "Funcionários", "Pinheiros"]);
    // The reference's commute is "neutro": last on the commute sub-score both ways
    clickHeader("Deslocamento");
    expect(tableNames()).toEqual(["Funcionários", "Botafogo", "Pinheiros", "Setor Marista"]);
    clickHeader("Deslocamento");
    expect(tableNames()).toEqual(["Pinheiros", "Botafogo", "Funcionários", "Setor Marista"]);
  });

  it("sorts Tempo Nubank by the upper bound of 'A-B min', ties by score rank, references last", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    clickHeader("Tempo Nubank");
    // 15 (Pinheiros, #3) = 15 (Botafogo, #4) < 25 (Funcionários); the reference has no commute
    expect(tableNames()).toEqual(["Pinheiros", "Botafogo", "Funcionários", "Setor Marista"]);
    clickHeader("Tempo Nubank");
    expect(tableNames()).toEqual(["Funcionários", "Pinheiros", "Botafogo", "Setor Marista"]);
  });

  it("sorts the mobile cards from the 'Ordenar por' select and its direction button", () => {
    render(<NeighborhoodsTab ctl={ctl()} />);
    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(
      screen.getAllByRole("columnheader").map((th) => within(th).getByRole("button").textContent!.replace(/[▲▼]/g, "")),
    );
    expect(select.value).toBe("score");
    const cardNames = () =>
      [...document.querySelectorAll("article")].map((a) =>
        a.getAttribute("data-testid") === "reference-neighborhood-card" ? "Setor Marista" : a.querySelector("button.text-primary")!.textContent,
      );
    fireEvent.change(select, { target: { value: "name" } });
    expect(cardNames()).toEqual(["Botafogo", "Funcionários", "Pinheiros", "Setor Marista"]);
    expect(header("Bairro").getAttribute("aria-sort")).toBe("ascending");
    const direction = screen.getByTestId("neighborhood-sort-direction");
    expect(direction.getAttribute("aria-label")).toBe("Ordem crescente");
    fireEvent.click(direction);
    expect(cardNames()).toEqual(["Setor Marista", "Pinheiros", "Funcionários", "Botafogo"]);
    expect(direction.getAttribute("aria-label")).toBe("Ordem decrescente");
  });
});
