// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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
  return {
    activeTab: "neighborhoods",
    dynamicNeighborhoods: [BH, SP],
    referenceNeighborhood: null,
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
        ctl={buildCtl({ selectedCities: ["RJ"], dynamicNeighborhoods: [BH] })}
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
          dynamicNeighborhoods: [
            makeNeighborhood({ overallPosition: 1, dynamicOverallRank: 4 }),
          ],
        })}
      />,
    );
    expect(screen.getAllByText("(-3)").length).toBeGreaterThanOrEqual(1);
  });
});

const REF: ReferenceNeighborhoodRow = {
  key: "GO:Setor Marista",
  neighborhood: "Setor Marista",
  dynamicScore: 9.3,
  urbanBreathingScore: 10,
  commuteLogisticsScore: 7.5,
  buildingStockFitScore: 9.5,
  budgetFitScore: 8.5,
  safetyCarScore: 8.5,
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
  it("renders Setor Marista between the rows scoring above and below it, without a rank", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhood: REF })} />);
    const bodyRows = [...document.querySelectorAll("tbody tr")];
    expect(bodyRows).toHaveLength(3);
    expect(bodyRows[0]!.textContent).toContain("Funcionários");
    expect(bodyRows[1]!.getAttribute("data-testid")).toBe("reference-neighborhood-row");
    expect(bodyRows[2]!.textContent).toContain("Pinheiros");
    // Catalog ranks stay as computed; the reference shows a badge instead of a number
    expect(bodyRows[0]!.textContent).toContain("#1");
    expect(bodyRows[2]!.textContent).toContain("#2");
    expect(bodyRows[1]!.textContent).not.toMatch(/#\d/);
    expect(bodyRows[1]!.textContent).toContain("Referência");
    expect(bodyRows[1]!.textContent).toContain("neutro");
    expect(screen.getAllByText("Seu bairro de referência — não entra no ranking")).toHaveLength(2);
    const cards = [...document.querySelectorAll("article")];
    expect(cards.map((c) => c.getAttribute("data-testid"))).toEqual([null, "reference-neighborhood-card", null]);
  });

  it("goes last when it scores below every visible row and is hidden without rows", () => {
    const low = { ...REF, dynamicScore: 5 };
    const { unmount } = render(<NeighborhoodsTab ctl={buildCtl({ referenceNeighborhood: low })} />);
    const bodyRows = [...document.querySelectorAll("tbody tr")];
    expect(bodyRows.at(-1)!.getAttribute("data-testid")).toBe("reference-neighborhood-row");
    unmount();
    render(
      <NeighborhoodsTab
        ctl={buildCtl({ referenceNeighborhood: REF, selectedCities: ["RJ"], dynamicNeighborhoods: [BH] })}
      />,
    );
    expect(screen.queryByTestId("reference-neighborhood-row")).toBeNull();
  });

  it("opens the research panel for GO:Setor Marista on click", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const ctl = buildCtl({ referenceNeighborhood: REF });
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
});

describe("NeighborhoodsTab metric columns", () => {
  it("shows the five sub-scores with the current weights in the header tooltips", () => {
    render(<NeighborhoodsTab ctl={buildCtl({ weights: { ...DEFAULT_WEIGHTS, budgetFitWeight: 1.5 } })} />);
    for (const label of ["Vida urbana", "Deslocamento", "Prédios", "Preço", "Segurança"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeTruthy();
    }
    expect(screen.getByRole("columnheader", { name: "Preço" }).getAttribute("title")).toBe(
      "Preço (0–10) · peso atual 1,5×",
    );
    const funcionarios = document.querySelector("tbody tr")!;
    const cells = [...funcionarios.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells.slice(4, 9)).toEqual(["9.5", "9.8", "9.4", "9.5", "9.6"]);
  });

  it("shows Marista, density and apartments from the research summary, with — otherwise", () => {
    render(
      <NeighborhoodsTab
        ctl={buildCtl({
          referenceNeighborhood: REF,
          neighborhoodResearch: {
            "BH:Funcionários": summary({}),
            "GO:Setor Marista": summary({ key: "GO:Setor Marista", marista: 8.03, densityPerKm2: 5061, apartmentsShare: 87.3 }),
          },
        })}
      />,
    );
    const [bh, ref, sp] = [...document.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent).slice(9, 12),
    );
    expect(bh).toEqual(["6,7", "14 mil", "99%"]);
    expect(ref).toEqual(["8,0", "5,1 mil", "87%"]);
    expect(sp).toEqual(["—", "—", "—"]);
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
});
