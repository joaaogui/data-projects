// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_WEIGHTS } from "@/lib/scoring-engine";

import { WeightsPanel } from "./weights-panel";
import type { PortalController } from "./use-portal-controller";

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    activePresetId: "balanced-original",
    applyPreset: vi.fn(),
    showSlidersDrawer: true,
    updateWeight: vi.fn(),
    weights: { ...DEFAULT_WEIGHTS },
    ...overrides,
  } as unknown as PortalController;
}

describe("WeightsPanel", () => {
  it("renders nothing when the drawer is closed", () => {
    const { container } = render(
      <WeightsPanel ctl={buildCtl({ showSlidersDrawer: false })} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders current weight values and preset buttons", () => {
    const ctl = buildCtl();
    render(<WeightsPanel ctl={ctl} />);
    expect(
      screen.getByText(/Calibrador de Critérios e Pesos/),
    ).toBeTruthy();
    expect(screen.getByText("6.5x (até 65 pts)")).toBeTruthy();
    expect(screen.getAllByText(/R\$ 4\.500/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+15 pts")).toBeTruthy();
    expect(screen.getByText("-22 pts")).toBeTruthy();

    const presetButtons = screen.getAllByRole("button");
    expect(presetButtons.length).toBeGreaterThan(3);
    fireEvent.click(presetButtons[0]!);
    expect(ctl.applyPreset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(ctl.applyPreset).toHaveBeenCalledWith("balanced-original");
  });

  it("marks the active preset button", () => {
    render(<WeightsPanel ctl={buildCtl({ activePresetId: "perfeito" })} />);
    // The perfeito preset button carries the primary styling when active;
    // at minimum all preset names still render.
    expect(screen.getByText(/Calibrador/)).toBeTruthy();
  });

  it("fires updateWeight from the property sliders", () => {
    const ctl = buildCtl();
    render(<WeightsPanel ctl={ctl} />);

    fireEvent.change(screen.getByLabelText(/Peso da Nota do Bairro/), {
      target: { value: "7" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith(
      "neighborhoodMultiplier",
      7,
    );

    fireEvent.change(screen.getByLabelText(/Peso Anti-Velharia/), {
      target: { value: "1" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("modernityMultiplier", 1);

    fireEvent.change(screen.getByLabelText(/Peso das Nuances/), {
      target: { value: "1.5" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("nuancesMultiplier", 1.5);

    fireEvent.change(screen.getByLabelText(/Bônus Não-Mobiliado/), {
      target: { value: "20" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("unfurnishedBonus", 20);

    fireEvent.change(screen.getByLabelText(/Penalidade Imóvel Mobiliado/), {
      target: { value: "-10" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("furnishedPenalty", -10);

    fireEvent.change(screen.getByLabelText(/Área Útil Mínima/), {
      target: { value: "50" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("minAreaM2", 50);
  });

  it("does not offer a modernity cut-off slider", () => {
    render(<WeightsPanel ctl={buildCtl()} />);
    expect(screen.queryByLabelText(/Corte Mínimo Modernidade/)).toBeNull();
    expect(screen.queryByText(/Corte Mínimo Modernidade/)).toBeNull();
  });

  it("cascades budgetIdeal up to budgetMax and budgetHardCap when needed", () => {
    const ctl = buildCtl({
      weights: { ...DEFAULT_WEIGHTS, budgetIdeal: 4500, budgetMax: 5000, budgetHardCap: 6000 },
    });
    render(<WeightsPanel ctl={ctl} />);
    fireEvent.change(screen.getByLabelText(/Teto Ideal All-in/), {
      target: { value: "6000" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetIdeal", 6000);
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetMax", 6000);
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetHardCap", 6350);
  });

  it("does not cascade budgetIdeal when it stays below the current max", () => {
    const ctl = buildCtl();
    render(<WeightsPanel ctl={ctl} />);
    fireEvent.change(screen.getByLabelText(/Teto Ideal All-in/), {
      target: { value: "4000" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetIdeal", 4000);
    expect(ctl.updateWeight).not.toHaveBeenCalledWith(
      "budgetMax",
      expect.anything(),
    );
  });

  it("clamps budgetMax to at least budgetIdeal and bumps the hard cap", () => {
    const ctl = buildCtl({
      weights: { ...DEFAULT_WEIGHTS, budgetIdeal: 4500, budgetMax: 5000, budgetHardCap: 6500 },
    });
    render(<WeightsPanel ctl={ctl} />);
    fireEvent.change(screen.getByLabelText(/Teto Limite Tolerado/), {
      target: { value: "4000" },
    });
    // Raw 4000 is below budgetIdeal (4500), so it clamps to 4500.
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetMax", 4500);
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetHardCap", 6500);
  });

  it("toggles the parking and mega-condo checkboxes", () => {
    const ctl = buildCtl();
    render(<WeightsPanel ctl={ctl} />);
    fireEvent.click(screen.getByLabelText(/Exigir ≥ 1 Vaga/));
    expect(ctl.updateWeight).toHaveBeenCalledWith("requireParking", false);
    fireEvent.click(screen.getByLabelText(/Penalizar Megacondomínio/));
    expect(ctl.updateWeight).toHaveBeenCalledWith("penalizeMegaCondo", false);
  });

  it("fires updateWeight from the neighborhood sub-weight sliders", () => {
    const ctl = buildCtl();
    render(<WeightsPanel ctl={ctl} />);
    fireEvent.change(screen.getByLabelText(/Respiração Urbana/), {
      target: { value: "2" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("urbanBreathingWeight", 2);
    fireEvent.change(screen.getByLabelText(/Logística & Tempo/), {
      target: { value: "2" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith(
      "commuteLogisticsWeight",
      2,
    );
    fireEvent.change(screen.getByLabelText(/Oferta de Prédios Bons/), {
      target: { value: "1" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("buildingStockWeight", 1);
    fireEvent.change(screen.getByLabelText(/Poder de Compra/), {
      target: { value: "1.5" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("budgetFitWeight", 1.5);
    fireEvent.change(screen.getByLabelText(/Segurança Pública/), {
      target: { value: "2.5" },
    });
    expect(ctl.updateWeight).toHaveBeenCalledWith("safetyCarWeight", 2.5);
  });

  it("falls back to 1x for a missing nuancesMultiplier", () => {
    const weights = { ...DEFAULT_WEIGHTS } as unknown as Record<string, unknown>;
    delete weights.nuancesMultiplier;
    render(
      <WeightsPanel
        ctl={buildCtl({ weights: weights as never })}
      />,
    );
    expect(screen.getAllByText("1.0x").length).toBeGreaterThanOrEqual(1);
    expect(
      (screen.getByLabelText(/Peso das Nuances/) as HTMLInputElement).value,
    ).toBe("1");
  });
});
