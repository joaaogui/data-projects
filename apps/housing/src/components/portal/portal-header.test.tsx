// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalHeader } from "./portal-header";
import type { PortalController } from "./use-portal-controller";

vi.mock("@data-projects/ui", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    hasAwaitingDetailedQa: false,
    isRefreshing: false,
    meta: {
      updatedAt: "2026-10-01T12:00:00.000Z",
      source: "snapshot",
      totalCount: 1234,
      neighborhoods: [],
      neighborhoodNamesByCity: {},
    },
    qaItems: [],
    recentListingsCount: 0,
    refreshDatasetFromServer: vi.fn(),
    scrapeStatus: { jobId: "none", status: "idle" },
    setShowChatDrawer: vi.fn(),
    setShowScrapeDrawer: vi.fn(),
    setShowSlidersDrawer: vi.fn(),
    showChatDrawer: false,
    showScrapeDrawer: false,
    showSlidersDrawer: false,
    ...overrides,
  } as unknown as PortalController;
}

type Updater = (v: boolean) => boolean;

describe("PortalHeader", () => {
  it("renders the title, snapshot badge and action buttons", () => {
    render(<PortalHeader ctl={buildCtl()} />);
    expect(screen.getByText("Housing")).toBeTruthy();
    expect(screen.getByText(/BH · CP · RJ/)).toBeTruthy();
    expect(screen.getByText(/1\.234 imóveis/)).toBeTruthy();
    // The header Chat button was removed as a duplicate of the floating
    // Assistente launcher (12766cf).
    expect(
      screen.queryByRole("button", { name: /Abrir assistente de imóveis/ }),
    ).toBeNull();
    expect(screen.getByText("Tema")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Voltar para joaog\.space/ }).getAttribute("href"),
    ).toBe("https://joaog.space");
    expect(
      screen.getByRole("button", { name: /Atualizar Anúncios/ }),
    ).toBeTruthy();
  });

  it("shows the recent-listings suffix in the snapshot badge", () => {
    render(
      <PortalHeader ctl={buildCtl({ recentListingsCount: 5 })} />,
    );
    expect(screen.getByText(/\(5 novos\)/)).toBeTruthy();
    expect(screen.getByText(/1\.234 imóveis/)).toBeTruthy();
  });

  it("omits the snapshot badge when there is no updatedAt", () => {
    render(
      <PortalHeader
        ctl={buildCtl({
          meta: {
            updatedAt: "",
            source: "snapshot",
            totalCount: 0,
            neighborhoods: [],
            neighborhoodNamesByCity: {},
          } as never,
        })}
      />,
    );
    expect(screen.queryByText(/Base:/)).toBeNull();
    expect(screen.getByText("Housing")).toBeTruthy();
  });

  it("toggles the scrape and sliders drawers with functional updaters", () => {
    const ctl = buildCtl();
    render(<PortalHeader ctl={ctl} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Atualizar Anúncios e Verificar Disponibilidade/,
      }),
    );
    const scrapeUpdater = vi.mocked(ctl.setShowScrapeDrawer).mock
      .calls[0]![0] as unknown as Updater;
    expect(scrapeUpdater(false)).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: /Calibrador de Critérios e Pesos/ }),
    );
    const slidersUpdater = vi.mocked(ctl.setShowSlidersDrawer).mock
      .calls[0]![0] as unknown as Updater;
    expect(slidersUpdater(false)).toBe(true);
  });

  it("reflects open drawers via aria state", () => {
    render(
      <PortalHeader
        ctl={buildCtl({
          showScrapeDrawer: true,
          showSlidersDrawer: true,
        })}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /Atualizar Anúncios/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /Calibrador/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("refreshes the dataset and disables the button while refreshing", () => {
    const ctl = buildCtl();
    const { rerender } = render(<PortalHeader ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Recarregar dados do servidor/ }),
    );
    expect(ctl.refreshDatasetFromServer).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recarregar")).toBeTruthy();

    rerender(<PortalHeader ctl={buildCtl({ isRefreshing: true })} />);
    const btn = screen.getByRole("button", {
      name: /Recarregar dados do servidor/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText("Sincronizando...")).toBeTruthy();
  });

  it("shows the updating state while a scrape is running", () => {
    render(
      <PortalHeader
        ctl={buildCtl({
          scrapeStatus: { jobId: "j1", status: "running" },
        })}
      />,
    );
    expect(screen.getByText("Atualizando Base...")).toBeTruthy();
  });
});
