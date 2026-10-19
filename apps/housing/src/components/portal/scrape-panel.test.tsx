// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScrapePanel } from "./scrape-panel";
import type { PortalController } from "./use-portal-controller";

function buildCtl(
  overrides: Partial<PortalController> = {},
): PortalController {
  return {
    cancelScrapeJob: vi.fn(),
    customSearchUrl: "",
    favoriteKeys: ["quintoandar:1"],
    filteredItems: [],
    isStartingScrape: false,
    postPropertyQuery: vi.fn(async () => ({ keys: ["quintoandar:9"] })),
    queryFavorites: [],
    queryFilters: {},
    scrapeCities: ["BH", "SP"],
    scrapeStatus: { jobId: "none", status: "idle" },
    selectedNeighborhoods: [],
    setCustomSearchUrl: vi.fn(),
    setScrapeCities: vi.fn(),
    setShowScrapeDrawer: vi.fn(),
    showScrapeDrawer: true,
    startScrapeJob: vi.fn(),
    toggleScrapeCity: vi.fn(),
    weights: {},
    ...overrides,
  } as unknown as PortalController;
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

describe("ScrapePanel", () => {
  it("renders nothing when the drawer is closed", () => {
    const { container } = render(
      <ScrapePanel ctl={buildCtl({ showScrapeDrawer: false })} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders the panel, closes it, and toggles scrape cities", () => {
    const ctl = buildCtl();
    render(<ScrapePanel ctl={ctl} />);
    expect(
      screen.getByText(/Painel de Scrape e Atualização/),
    ).toBeTruthy();
    expect(
      screen.getByText("Todos os bairros-alvo configurados nas praças selecionadas."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(ctl.setShowScrapeDrawer).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /^BH/ }));
    expect(ctl.toggleScrapeCity).toHaveBeenCalledWith("BH");

    fireEvent.click(
      screen.getByRole("button", { name: "Selecionar todas" }),
    );
    expect(ctl.setScrapeCities).toHaveBeenCalledWith(["BH", "RJ", "CP", "SP"]);
  });

  it("shows selected neighborhoods and the offline-runner warning", () => {
    render(
      <ScrapePanel
        ctl={buildCtl({
          selectedNeighborhoods: ["BH:Funcionários"],
          scrapeStatus: {
            jobId: "none",
            status: "idle",
            workerAvailable: false,
          },
        })}
      />,
    );
    expect(screen.getByText(/BH:Funcionários/)).toBeTruthy();
    expect(screen.getByText(/Runner local offline/)).toBeTruthy();
  });

  it("hides the offline-runner warning unless the worker is reported unavailable", () => {
    render(<ScrapePanel ctl={buildCtl()} />);
    expect(screen.queryByText(/Runner local offline/)).toBeNull();
  });

  it("starts a full sync with the selected cities and neighborhoods", () => {
    const ctl = buildCtl({ selectedNeighborhoods: ["BH:Funcionários"] });
    render(<ScrapePanel ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Buscar Novos \+ Atualizar Desativados/ }),
    );
    expect(ctl.startScrapeJob).toHaveBeenCalledWith({
      mode: "full_sync",
      cities: ["BH", "SP"],
      neighborhoods: ["BH:Funcionários"],
    });
  });

  it("verifies favorites + top keys via postPropertyQuery, falling back to filtered items on error", async () => {
    const postPropertyQuery = vi.fn(async () => ({
      keys: ["quintoandar:9", "quintoandar:1"],
    }));
    const ctl = buildCtl({ postPropertyQuery: postPropertyQuery as never });
    render(<ScrapePanel ctl={ctl} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Verificar Favoritos \(1\)/ }),
    );
    await flush();
    expect(postPropertyQuery).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "activeKeys", limit: 25 }),
    );
    expect(ctl.startScrapeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "verify_only",
        keys: ["quintoandar:1", "quintoandar:9"],
      }),
    );

    // Error path: fall back to active filtered items (deduped with favorites)
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const ctl2 = buildCtl({
      postPropertyQuery: failing as never,
      filteredItems: [
        { provider: "quintoandar", id: "2", isActive: true },
        { provider: "quintoandar", id: "3", isActive: false },
      ] as never,
    });
    render(<ScrapePanel ctl={ctl2} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Verificar Favoritos \(1\)/ })[1]!,
    );
    await flush();
    expect(ctl2.startScrapeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "verify_only",
        keys: ["quintoandar:1", "quintoandar:2"],
      }),
    );
  });

  it("handles the custom URL input and extract action", () => {
    const ctl = buildCtl({ customSearchUrl: " https://example.com/busca " });
    render(<ScrapePanel ctl={ctl} />);
    const input = screen.getByPlaceholderText(
      /quintoandar\.com\.br\/alugar/,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://example.com/x" } });
    expect(ctl.setCustomSearchUrl).toHaveBeenCalledWith(
      "https://example.com/x",
    );
    fireEvent.click(screen.getByRole("button", { name: "Extrair URL" }));
    expect(ctl.startScrapeJob).toHaveBeenCalledWith({
      mode: "custom_url",
      cities: ["BH", "SP"],
      customUrl: "https://example.com/busca",
    });
  });

  it("disables actions while running and disables Extract for a blank URL", () => {
    render(
      <ScrapePanel
        ctl={buildCtl({
          customSearchUrl: "   ",
          scrapeStatus: { jobId: "j1", status: "running" },
        })}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Buscar Novos \+ Atualizar Desativados/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Extrair URL" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows running progress, counters, logs, error and cancel", () => {
    const ctl = buildCtl({
      scrapeStatus: {
        jobId: "j1",
        status: "running",
        phase: "Buscando BH",
        currentSearchLabel: "BH centro",
        completedSteps: 1,
        totalSteps: 4,
        newListingsAdded: 3,
        deactivatedCount: 2,
        verifiedCount: 9,
        updatedAt: "2026-10-01T12:00:00.000Z",
        error: "Aviso parcial",
        logs: ["linha 1", "linha 2"],
      },
    });
    render(<ScrapePanel ctl={ctl} />);
    expect(screen.getByText("Em execução")).toBeTruthy();
    expect(screen.getByText("Buscando BH")).toBeTruthy();
    expect(screen.getByText("(BH centro)")).toBeTruthy();
    expect(screen.getByText("+3 novos anúncios")).toBeTruthy();
    expect(screen.getByText(/2 marcados como/)).toBeTruthy();
    expect(screen.getByText("9 verificados")).toBeTruthy();
    expect(screen.getByText("Etapa 1 de 4 (25%)")).toBeTruthy();
    expect(screen.getByText("Aviso parcial")).toBeTruthy();
    expect(screen.getByText(/Logs ao vivo \(2 linhas\)/)).toBeTruthy();
    expect(screen.getByText(/linha 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(ctl.cancelScrapeJob).toHaveBeenCalledTimes(1);
  });

  it("shows completed progress at 100% without a cancel button", () => {
    render(
      <ScrapePanel
        ctl={buildCtl({
          scrapeStatus: {
            jobId: "j1",
            status: "completed",
            completedSteps: 2,
            totalSteps: 4,
          },
        })}
      />,
    );
    expect(screen.getByText("Concluído")).toBeTruthy();
    expect(screen.getByText("Etapa 2 de 4 (100%)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cancelar/ })).toBeNull();
  });

  it("shows the failed state", () => {
    render(
      <ScrapePanel
        ctl={buildCtl({
          scrapeStatus: { jobId: "j1", status: "failed", phase: "Falhou" },
        })}
      />,
    );
    expect(screen.getByText("Interrompido / Falhou")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Cancelar/ })).toBeNull();
  });
});
