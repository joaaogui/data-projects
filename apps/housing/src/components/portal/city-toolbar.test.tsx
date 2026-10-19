// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CityToolbar } from "./city-toolbar";
import type { PortalController } from "./use-portal-controller";

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    activeTab: "properties",
    filteredTotal: 42,
    setActiveTab: vi.fn(),
    ...overrides,
  } as unknown as PortalController;
}

describe("CityToolbar", () => {
  it("renders only the Imóveis and Top Bairros tabs with the result count", () => {
    render(<CityToolbar ctl={buildCtl()} />);

    const propertiesTab = screen.getByRole("button", {
      name: /Imóveis \(42\)/,
    });
    const neighborhoodsTab = screen.getByRole("button", {
      name: "Top Bairros",
    });
    expect(propertiesTab).toBeTruthy();
    expect(neighborhoodsTab).toBeTruthy();
    // Active tab is the filled one (activeTab: "properties" by default).
    expect(propertiesTab.getAttribute("class")).toContain("bg-primary");
    expect(neighborhoodsTab.getAttribute("class")).toContain("bg-secondary");

    // Comparador tab removed (bffc444).
    expect(screen.queryByRole("button", { name: /Comparador/ })).toBeNull();
    // The city selector lives in the filter bar now (city-toolbar.tsx:
    // "the city selector lives in the filter bar"); no city pills here.
    // City-pill behaviour is covered in filters-panel.test.tsx.
    expect(screen.queryByRole("button", { name: "Todas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "BH" })).toBeNull();
    expect(screen.queryByRole("button", { name: "SP" })).toBeNull();
    expect(screen.queryByRole("button", { name: /BSB \(Ref\)/ })).toBeNull();
  });

  it("switches tabs via the controller", () => {
    const ctl = buildCtl();
    render(<CityToolbar ctl={ctl} />);

    fireEvent.click(screen.getByRole("button", { name: "Top Bairros" }));
    expect(ctl.setActiveTab).toHaveBeenCalledWith("neighborhoods");
    fireEvent.click(screen.getByRole("button", { name: /Imóveis \(42\)/ }));
    expect(ctl.setActiveTab).toHaveBeenCalledWith("properties");
  });

  it("marks Top Bairros as the active tab when activeTab is neighborhoods", () => {
    render(<CityToolbar ctl={buildCtl({ activeTab: "neighborhoods" })} />);

    expect(
      screen
        .getByRole("button", { name: "Top Bairros" })
        .getAttribute("class"),
    ).toContain("bg-primary");
    expect(
      screen
        .getByRole("button", { name: /Imóveis \(42\)/ })
        .getAttribute("class"),
    ).toContain("bg-secondary");
  });
});
