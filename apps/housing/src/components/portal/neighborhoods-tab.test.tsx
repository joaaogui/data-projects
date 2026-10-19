// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NeighborhoodsTab } from "./neighborhoods-tab";
import type { PortalController } from "./use-portal-controller";
import type { ComputedNeighborhood } from "@/types/housing";

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
