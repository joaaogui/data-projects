// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BenchmarkBanner } from "./benchmark-banner";
import type { PortalController } from "./use-portal-controller";

const STATS = {
  totalScrapedBsb: 120,
  totalEligibleBsb: 40,
  bsbModernMedianMonthly: 4200,
  contractGapReais: 800,
  contractGapPct: 24,
  countUpTo3400: 5,
  countModernUpTo3400: 2,
  countUpTo4000: 15,
  countUpTo4500: 25,
  cityComparisons: [
    {
      code: "BSB" as const,
      label: "Águas Claras (Norte & Sul)",
      medianMonthly: 4200,
      medianPm2: 60,
      medianScore: 80,
    },
    {
      code: "BH" as const,
      label: "BH — Funcionários",
      medianMonthly: null,
      medianPm2: null,
      medianScore: null,
    },
  ],
};

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    benchmarkPanelCollapsed: false,
    bsbBenchmarkStats: STATS,
    enableBsbBenchmark: true,
    handleToggleHiddenCity: vi.fn(),
    maxTotalMonthly: 5000,
    selectedCities: [],
    setBenchmarkPanelCollapsed: vi.fn(),
    setMaxTotalMonthly: vi.fn(),
    setOnlyTop20Neighborhoods: vi.fn(),
    setSelectedCities: vi.fn(),
    setSelectedNeighborhoods: vi.fn(),
    setVisibleCount: vi.fn(),
    ...overrides,
  } as unknown as PortalController;
}

describe("BenchmarkBanner", () => {
  it("renders nothing when benchmark mode is off", () => {
    const { container } = render(
      <BenchmarkBanner ctl={buildCtl({ enableBsbBenchmark: false })} />,
    );
    expect(container.textContent).toBe("");
    expect(screen.queryByTestId("bsb-benchmark-banner")).toBeNull();
  });

  it("renders the stats grid, comparisons and sem-amostra fallback", () => {
    render(<BenchmarkBanner ctl={buildCtl()} />);
    expect(screen.getByTestId("bsb-benchmark-banner")).toBeTruthy();
    expect(screen.getByText(/MODO BENCHMARK TEMPORÁRIO/)).toBeTruthy();
    expect(screen.getByText(/120 anúncios/)).toBeTruthy();
    expect(screen.getAllByText(/4\.200/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\+R\$ 800\/mês ou \+24%/)).toBeTruthy();
    expect(screen.getByText("Sem amostra")).toBeTruthy();
    expect(screen.getByText(/R\$ 4\.200 · R\$ 60\/m² · 80\.0 pts/)).toBeTruthy();
    expect(screen.getByText(/Ver só Águas Claras \(40/)).toBeTruthy();
  });

  it("shows the in-line contract gap copy when there is no gap", () => {
    render(
      <BenchmarkBanner
        ctl={buildCtl({
          bsbBenchmarkStats: { ...STATS, contractGapReais: 0, contractGapPct: 0 } as never,
        })}
      />,
    );
    expect(screen.getByText(/em linha com seu contrato/)).toBeTruthy();
  });

  it("collapses/expands via the toggle (functional updater) and deactivates", () => {
    const ctl = buildCtl();
    render(<BenchmarkBanner ctl={ctl} />);
    fireEvent.click(screen.getByRole("button", { name: "Recolher" }));
    const updater = vi.mocked(ctl.setBenchmarkPanelCollapsed).mock
      .calls[0]![0] as (v: boolean) => boolean;
    expect(typeof updater).toBe("function");
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: /Desativar Benchmark/ }),
    );
    expect(ctl.handleToggleHiddenCity).toHaveBeenCalledTimes(1);
    expect(ctl.handleToggleHiddenCity).toHaveBeenCalledWith("BSB");
  });

  it("hides the stats grid when collapsed and labels the button Expandir", () => {
    render(
      <BenchmarkBanner ctl={buildCtl({ benchmarkPanelCollapsed: true })} />,
    );
    expect(screen.getByRole("button", { name: "Expandir dados" })).toBeTruthy();
    expect(screen.queryByText(/Ver só Águas Claras/)).toBeNull();
    expect(screen.queryByText(/Seu Contrato Vigente/)).toBeNull();
  });

  it("applies the 'Ver só Águas Claras' preset", () => {
    const ctl = buildCtl();
    render(<BenchmarkBanner ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Ver só Águas Claras/ }),
    );
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["BSB"]);
    expect(ctl.setSelectedNeighborhoods).toHaveBeenCalledWith([]);
    expect(ctl.setOnlyTop20Neighborhoods).toHaveBeenCalledWith(false);
    expect(ctl.setMaxTotalMonthly).toHaveBeenCalledWith(null);
    expect(ctl.setVisibleCount).toHaveBeenCalledWith(30);
  });

  it("applies the R$ 3.400–3.600 preset", () => {
    const ctl = buildCtl();
    render(<BenchmarkBanner ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /O que R\$ 3\.400–3\.600 paga/ }),
    );
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["BSB"]);
    expect(ctl.setMaxTotalMonthly).toHaveBeenCalledWith(3600);
    expect(ctl.setVisibleCount).toHaveBeenCalledWith(30);
  });

  it("applies the Águas Claras + BH preset", () => {
    const ctl = buildCtl();
    render(<BenchmarkBanner ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Comparar Águas Claras \+ BH/ }),
    );
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["BSB", "BH"]);
    expect(ctl.setOnlyTop20Neighborhoods).toHaveBeenCalledWith(true);
    expect(ctl.setMaxTotalMonthly).toHaveBeenCalledWith(null);
  });

  it("applies the até R$ 4.200 three-city preset", () => {
    const ctl = buildCtl();
    render(<BenchmarkBanner ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Até R\$ 4\.200: Águas Claras vs\. BH vs\. Campinas/,
      }),
    );
    expect(ctl.setSelectedCities).toHaveBeenCalledWith(["BSB", "BH", "CP"]);
    expect(ctl.setMaxTotalMonthly).toHaveBeenCalledWith(4200);
    expect(ctl.setOnlyTop20Neighborhoods).toHaveBeenCalledWith(true);
  });
});
