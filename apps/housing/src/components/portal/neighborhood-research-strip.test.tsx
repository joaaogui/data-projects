// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NeighborhoodResearchStrip, researchStripNumbers } from "./neighborhood-research-strip";
import type { NeighborhoodDossier, NeighborhoodResearchSummary } from "@/types/neighborhood-research";

const SUMMARY: NeighborhoodResearchSummary = {
  key: "BH:Lourdes",
  marista: 7.4,
  maristaSource: "rubric",
  robberyRatio: 1.18,
  densityPerKm2: 14023,
  apartmentsShare: 99.1,
  highlight: "Rua Curitiba: bares com mesas na calçada",
  redFlag: "Série de roubos de correntes em 2025-26",
};

const DOSSIER: NeighborhoodDossier = {
  key: "BH:Lourdes",
  city: "BH",
  neighborhood: "Lourdes",
  researchedAt: "2026-10-19",
  numbers: [
    {
      metric: "density",
      label: "Densidade",
      value: 14023,
      unit: "hab/km²",
      year: 2022,
      scope: "bairro",
      source: "IBGE Censo 2022 via MINDATA",
      url: "https://example.com/ibge",
    },
  ],
  crime: {
    officialUnit: "MG: SEJUSP publica roubo por bairro; furto só por município",
    scope: "bairro (SEJUSP)",
    summary: "40 roubos consumados em 12 meses.",
    series: [
      {
        kind: "robbery",
        indicator: "roubo consumado",
        period: "2025-03 a 2026-02",
        value: 40,
        perCapita: 226,
        ratioToCity: 1.18,
        comparison: "BH ≈191/100 mil",
        source: "SEJUSP/MG via Crime Brasil",
        url: "https://example.com/crime",
      },
    ],
  },
  highlights: ["3º bairro mais caminhável de BH"],
  redFlags: ["Aluguel médio ~R$ 4 mil"],
  opinions: [
    {
      stance: "positive",
      theme: "safety",
      quote: "Seguro e com muitos serviços perto",
      source: "r/BHConversas",
      url: "https://example.com/reddit",
      date: "2026-01",
    },
  ],
  news: [
    { date: "2026-04-08", headline: "Moradores cobram policiamento", outlet: "O Tempo", url: "https://example.com/news" },
  ],
  facts: [{ fact: "Praça Marília de Dirceu arborizada", source: "Belotur", url: "https://example.com/fact" }],
  gaps: ["Furtos por bairro não publicados"],
  maristaJudgement: { score: 7.5, why: "juízo" },
  rubric: {
    total: 7.4,
    measuredShare: 0.6,
    criteria: [
      { name: "Arborização", score: 8, evidence: [{ text: "Copa arbórea 30%", url: "https://example.com/tree" }] },
      { name: "Relevo plano", score: null, evidence: [] },
    ],
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("researchStripNumbers", () => {
  it("formats Marista, robbery ratio and density in pt-BR", () => {
    expect(researchStripNumbers(SUMMARY).map((n) => n.text)).toEqual([
      "Marista 7,4/10",
      "Roubo 1,2×/morador",
      "14 mil hab/km²",
    ]);
  });

  it("flags the per-resident robbery ratio only for commercial bairros", () => {
    const robbery = (key: string) =>
      researchStripNumbers({ ...SUMMARY, key }).find((n) => n.id === "robbery")!.text;
    expect(robbery("BH:Funcionários")).toBe("Roubo 1,2×/morador");
    expect(robbery("BH:Savassi")).toBe("Roubo 1,2×/morador");
    expect(robbery("BH:Santo Agostinho")).toBe("Roubo 1,2× média");
    expect(robbery("RJ:Flamengo")).toBe("Roubo 1,2× média");
  });

  it("marks the researcher's judgement as approximate and skips missing numbers", () => {
    const texts = researchStripNumbers({
      ...SUMMARY,
      marista: 6.5,
      maristaSource: "judgement",
      robberyRatio: null,
      densityPerKm2: 1985,
    }).map((n) => n.text);
    expect(texts).toEqual(["Marista ≈6,5/10", "2 mil hab/km²"]);
  });
});

describe("NeighborhoodResearchStrip", () => {
  it("shows the numbers and both chips, and stops the card from expanding", () => {
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <NeighborhoodResearchStrip summary={SUMMARY} neighborhood="Lourdes" />
      </div>,
    );
    const strip = screen.getByTestId("neighborhood-research-strip");
    expect(strip.textContent).toContain("Marista 7,4/10");
    expect(strip.textContent).toContain("Roubo 1,2×/morador");
    expect(screen.getByText(SUMMARY.highlight!)).toBeTruthy();
    expect(screen.getByText(SUMMARY.redFlag!)).toBeTruthy();
    expect(strip.getAttribute("data-card-stop-expand")).toBe("true");

    fetchMock.mockReturnValue(new Promise(() => {}));
    fireEvent.click(strip);
    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Pesquisa do bairro Lourdes" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/neighborhoods/BH%3ALourdes", expect.anything());
  });

  it("renders nothing without numbers or chips", () => {
    const { container } = render(
      <NeighborhoodResearchStrip
        summary={{ ...SUMMARY, marista: null, robberyRatio: null, densityPerKm2: null, highlight: null, redFlag: null }}
        neighborhood="Lourdes"
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("NeighborhoodResearchPanel", () => {
  it("loads the dossier and shows every section with source links", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, dossier: DOSSIER }), { status: 200 }));
    render(<NeighborhoodResearchStrip summary={SUMMARY} neighborhood="Lourdes" />);
    fireEvent.click(screen.getByTestId("neighborhood-research-strip"));

    await waitFor(() => expect(screen.getByText("Números-chave")).toBeTruthy());
    const panel = screen.getByTestId("neighborhood-research-panel");
    expect(panel.textContent).toContain("1,18× média da cidade");
    expect(panel.textContent).toContain("bairro (SEJUSP)");
    expect(panel.textContent).toContain("Unidade oficial dos dados:");
    expect(panel.textContent).toContain("7,4/10");
    expect(panel.textContent).toContain("60% dos critérios medidos");
    expect(screen.getByRole("list", { name: "Critérios da rubrica" }).textContent).toContain("Relevo plano—");
    expect(panel.textContent).toContain("“Seguro e com muitos serviços perto”");
    expect(panel.textContent).toContain("08/04/2026");
    expect(panel.textContent).toContain("Furtos por bairro não publicados");

    const hrefs = Array.from(panel.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "https://example.com/ibge",
        "https://example.com/crime",
        "https://example.com/tree",
        "https://example.com/reddit",
        "https://example.com/news",
        "https://example.com/fact",
      ]),
    );
    expect(Array.from(panel.querySelectorAll("a")).every((a) => a.getAttribute("target") === "_blank")).toBe(true);
  });

  it("falls back to the researcher's judgement without a rubric, and closes on Escape", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, dossier: { ...DOSSIER, rubric: null } }), { status: 200 }),
    );
    render(<NeighborhoodResearchStrip summary={SUMMARY} neighborhood="Lourdes" />);
    fireEvent.click(screen.getByTestId("neighborhood-research-strip"));
    await waitFor(() => expect(screen.getByText(/juízo do pesquisador/)).toBeTruthy());
    expect(screen.getByTestId("neighborhood-research-panel").textContent).toContain("≈7,5/10");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("neighborhood-research-panel")).toBeNull();
  });

  it("shows the API error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Bairro sem pesquisa." }), { status: 404 }));
    render(<NeighborhoodResearchStrip summary={SUMMARY} neighborhood="Lourdes" />);
    fireEvent.click(screen.getByTestId("neighborhood-research-strip"));
    await waitFor(() => expect(screen.getByText("Bairro sem pesquisa.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
