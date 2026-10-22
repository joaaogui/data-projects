// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { researchStripNumbers } from "./neighborhood-research-strip";
import { NeighborhoodsTab } from "./neighborhoods-tab";
import type { PortalController } from "./use-portal-controller";
import { QOL_COLUMNS } from "@/lib/neighborhood-qol";
import type { ReferenceNeighborhoodRow } from "@/lib/reference-neighborhood";
import { DEFAULT_WEIGHTS } from "@/lib/scoring-engine";
import type { ComputedNeighborhood } from "@/types/housing";
import type { NeighborhoodResearchSummary, QolRow } from "@/types/neighborhood-research";

function nb(neighborhood: string, dynamicScore: number, urbanBreathingScore: number): ComputedNeighborhood {
  return {
    cityCode: "SP",
    cityName: "São Paulo",
    neighborhood,
    overallPosition: 1,
    cityPosition: 1,
    baseScore: 8,
    idhm: 0,
    commuteTime: "15 min",
    nubankHub: "Pinheiros",
    urbanBreathingScore,
    commuteLogisticsScore: 8,
    buildingStockFitScore: 8,
    budgetFitScore: 8,
    safetyCarScore: 8,
    shortRationale: "",
    detailedJustification: "",
    pros: [],
    cons: [],
    dynamicScore,
    dynamicOverallRank: 1,
    dynamicCityRank: 1,
    dynamicJustification: "",
  };
}

const MOEMA = nb("Moema", 9.0, 7.04);
const PERDIZES = nb("Perdizes", 8.5, 6.6);
const SUMARE = nb("Sumaré", 8.0, 6.0);

const REF: ReferenceNeighborhoodRow = {
  key: "GO:Setor Marista",
  neighborhood: "Setor Marista",
  dynamicScore: 8.8,
  urbanBreathingScore: 8.6,
  commuteLogisticsScore: 7.5,
  safetyCarScore: 8.5,
  shortRationale: "",
  detailedJustification: "",
};

const cell = (value: number | null, text: string, hint: string) => ({ value, text, hint });

const QOL: Record<string, QolRow> = {
  "SP:Moema": {
    idhm: cell(0.949, "0,949", "UDH Moema · São Paulo: 0,805"),
    income: cell(16312, "R$ 16,3 mil", "distrito IBGE Moema · São Paulo: R$ 5,0 mil"),
    robbery: cell(1.56, "1,6×", "27º DP Campo Belo · 1.304,3/100 mil vs São Paulo: 836,8/100 mil"),
    homicide: cell(1.35, "1,4×*", "27º DP · * contagem baixa (6 casos): taxa instável"),
    parks: cell(55.9, "55,9 ha", "parque ≥ 10 ha mais próximo: Parque Ibirapuera (125,9 ha) a 254 m"),
  },
  "SP:Perdizes": {
    idhm: cell(0.945, "0,945", "UDH Perdizes"),
    income: cell(12000, "R$ 12,0 mil", "distrito IBGE Perdizes"),
    robbery: cell(0.8, "0,8×", "23º DP"),
  },
  "GO:Setor Marista": {
    idhm: cell(0.939, "0,939", "UDH Marista"),
    income: cell(16100, "R$ 16,1 mil", "subdistrito Marista"),
    robbery: cell(null, "—", "SSP-GO publica só totais estaduais"),
  },
};

function buildCtl(overrides: Partial<PortalController> = {}): PortalController {
  const ranking = [MOEMA, PERDIZES, SUMARE];
  return {
    activeTab: "neighborhoods",
    neighborhoodRanking: ranking,
    dynamicNeighborhoods: ranking,
    referenceNeighborhoods: [REF],
    neighborhoodResearch: {},
    neighborhoodQol: QOL,
    weights: DEFAULT_WEIGHTS,
    selectedCities: [],
    setActiveTab: vi.fn(),
    setSelectedCities: vi.fn(),
    setSelectedNeighborhoods: vi.fn(),
    ...overrides,
  } as unknown as PortalController;
}

const header = (label: string) => screen.getByRole("columnheader", { name: label });
const clickHeader = (label: string) => fireEvent.click(within(header(label)).getByRole("button"));
const rows = () => [...document.querySelectorAll("tbody tr")];
const names = () => rows().map((tr) => tr.querySelector("td:nth-child(3) button")!.textContent);
const columnIndex = (label: string) => screen.getAllByRole("columnheader").indexOf(header(label));
const cellOf = (rowIdx: number, label: string) => rows()[rowIdx]!.querySelectorAll("td")[columnIndex(label)]!;

describe("NeighborhoodsTab quality-of-life columns", () => {
  it("adds the 8 display-only columns after Densidade, each with its definition tooltip", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    const labels = screen.getAllByRole("columnheader").map((th) => within(th).getByRole("button").textContent!.replace(/[▲▼]/g, ""));
    const at = labels.indexOf("Densidade");
    expect(labels.slice(at + 1, at + 9)).toEqual(QOL_COLUMNS.map((c) => c.label));
    for (const c of QOL_COLUMNS) expect(header(c.label).getAttribute("title")).toBe(c.title);
    expect(header("Roubo × cidade").getAttribute("title")).toMatch(/diferem por estado: a razão só compara bairros da mesma cidade/);
    expect(header("IDH-M").getAttribute("title")).toMatch(/2010.*Atlas do Desenvolvimento Humano/);
  });

  it("renders the values with scope and caveats on hover, — without data, reference rows included", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    expect(names()).toEqual(["Moema", "Setor Marista", "Perdizes", "Sumaré"]);
    expect(cellOf(0, "IDH-M").textContent).toBe("0,949");
    expect(cellOf(0, "Renda").getAttribute("title")).toBe("distrito IBGE Moema · São Paulo: R$ 5,0 mil");
    expect(cellOf(0, "Roubo × cidade").getAttribute("title")).toContain("27º DP Campo Belo");
    expect(cellOf(0, "Homicídio × cidade").textContent).toBe("1,4×*");
    expect(cellOf(0, "Homicídio × cidade").getAttribute("title")).toContain("taxa instável");
    expect(cellOf(0, "Parques 1 km").getAttribute("title")).toContain("Parque Ibirapuera");
    // The reference row shows its own values; its null robbery explains why on hover
    expect(cellOf(1, "Renda").textContent).toBe("R$ 16,1 mil");
    expect(cellOf(1, "Roubo × cidade").textContent).toBe("—");
    expect(cellOf(1, "Roubo × cidade").getAttribute("title")).toBe("SSP-GO publica só totais estaduais");
    // No data at all: "—" and no tooltip
    expect(cellOf(3, "IDH-M").textContent).toBe("—");
    expect(cellOf(3, "IDH-M").getAttribute("title")).toBeNull();
  });

  it("sorts with the existing machinery, rows without a value last in both directions", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    clickHeader("Renda");
    expect(names()).toEqual(["Moema", "Setor Marista", "Perdizes", "Sumaré"]);
    expect(header("Renda").getAttribute("aria-sort")).toBe("descending");
    clickHeader("Renda");
    expect(names()).toEqual(["Perdizes", "Setor Marista", "Moema", "Sumaré"]);
    // Crime sorts ascending first (lower is safer); the reference's null and Sumaré stay last
    clickHeader("Roubo × cidade");
    expect(header("Roubo × cidade").getAttribute("aria-sort")).toBe("ascending");
    expect(names()).toEqual(["Perdizes", "Moema", "Setor Marista", "Sumaré"]);
    clickHeader("Roubo × cidade");
    expect(names()).toEqual(["Moema", "Perdizes", "Setor Marista", "Sumaré"]);
  });

  it("puts the columns under 'Mais métricas' on mobile and in the 'Ordenar por' select", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    const options = [...select.options].map((o) => o.textContent);
    for (const c of QOL_COLUMNS) expect(options).toContain(c.label);
    const firstCard = () => document.querySelector("article")!;
    expect(firstCard().querySelector("[data-testid='mobile-qol-income']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mais métricas" }));
    const income = firstCard().querySelector("[data-testid='mobile-qol-income']")!;
    expect(income.textContent).toBe("RendaR$ 16,3 mil");
    expect(income.getAttribute("title")).toBe("distrito IBGE Moema · São Paulo: R$ 5,0 mil");
    expect(document.querySelector("[data-testid='reference-neighborhood-card'] [data-testid='mobile-qol-idhm']")!.textContent).toBe(
      "IDH-M0,939",
    );
    fireEvent.change(select, { target: { value: "income" } });
    expect(header("Renda").getAttribute("aria-sort")).toBe("descending");
  });

  it("prints Vida urbana exactly as the listing card strip does", () => {
    render(<NeighborhoodsTab ctl={buildCtl()} />);
    const tableText = cellOf(0, "Vida urbana").textContent!;
    const summary = { key: "SP:Moema", urbanLife: MOEMA.urbanBreathingScore, marista: 5.9 } as NeighborhoodResearchSummary;
    const [strip] = researchStripNumbers({ ...summary, maristaSource: "rubric", robberyRatio: null, densityPerKm2: null, apartmentsShare: null, highlight: null, redFlag: null });
    expect(tableText).toBe("7.0");
    expect(strip!.text).toBe(`Vida urbana ${tableText}/10`);
  });
});
