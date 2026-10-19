import { describe, expect, it } from "vitest";

import {
  buildResearchFile,
  cityRatio,
  crimeScope,
  researchKey,
  scrubAuthor,
} from "../../scripts/build-neighborhood-research";

describe("researchKey", () => {
  it("maps listing aliases onto the engine's catalog keys", () => {
    expect(researchKey("CP", "Jardim Guanabara")).toBe("CP:Jd. Guanabara");
    expect(researchKey("CP", "Jd. Guanabara")).toBe("CP:Jd. Guanabara");
    expect(researchKey("CP", "Jardim Chapadão")).toBe("CP:Jd. Chapadão");
    expect(researchKey("CP", "Parque Taquaral")).toBe("CP:Taquaral");
    expect(researchKey("RJ", "Botafogo")).toBe("RJ:Botafogo (Orla)");
    expect(researchKey("RJ", "Botafogo (Orla)")).toBe("RJ:Botafogo (Orla)");
    expect(researchKey("RJ", "Humaita")).toBe("RJ:Humaitá");
  });

  it("keeps same-named neighbourhoods of other cities apart", () => {
    expect(researchKey("CP", "Botafogo")).toBe("CP:Botafogo");
    expect(researchKey("BH", " Lourdes ")).toBe("BH:Lourdes");
  });
});

describe("scrubAuthor", () => {
  it("drops usernames and people's names but keeps the venue and role", () => {
    expect(scrubAuthor("r/BeloHorizonte (u/AlphaCharlieN7)")).toBe("r/BeloHorizonte");
    expect(scrubAuthor("r/BeloHorizonte (u/carribeiro, morador)")).toBe("r/BeloHorizonte (morador)");
    expect(scrubAuthor("Moradora Florinda Ramos Jorge (QuintoAndar)")).toBe("Moradora (QuintoAndar)");
    expect(scrubAuthor("Moradora (Renata) citada pelo QuintoAndar")).toBe("Moradora citada pelo QuintoAndar");
    expect(scrubAuthor("Helênio Soares, presidente da Amo Savassi, ao R7")).toBe("Presidente da Amo Savassi, ao R7");
    expect(scrubAuthor("PARC/Unicamp (Magaldi e Michalski, 2025)")).toBe("PARC/Unicamp (2025)");
    expect(scrubAuthor("Morador ouvido por O Tempo")).toBe("Morador ouvido por O Tempo");
  });
});

describe("cityRatio / crimeScope", () => {
  it("divides the unit rate by the city rate (pt-BR numbers)", () => {
    expect(cityRatio({ value: 40, perCapita: 226, comparison: "BH município: 4.624 roubos ≈ 191/100 mil" })).toBe(1.18);
    expect(cityRatio({ value: 533, perCapita: 481.8, comparison: "Município: 481,8/100 mil" })).toBe(1);
  });

  it("uses Campinas' per-DP average and skips state-only figures", () => {
    expect(cityRatio({ value: 238, perCapita: null, comparison: "Campinas average per DP (13 DPs): ~260" })).toBe(0.92);
    expect(cityRatio({ value: 3757, perCapita: 53.2, comparison: "ESTADO de Goiás inteiro" })).toBeNull();
  });

  it("labels the official unit", () => {
    expect(crimeScope("RJ CISP 10 (10ª DP Botafogo) — Botafogo", undefined)).toBe("CISP 10");
    expect(crimeScope("MG: SEJUSP/REDS publica roubo por bairro", undefined)).toBe("bairro (SEJUSP)");
    expect(crimeScope("SSP-SP 78º DP (Jardins), faixa perto da R. Estados Unidos", undefined)).toBe("78º DP");
  });
});

describe("buildResearchFile", () => {
  const url = (n: number) => `https://example.com/${n}`;
  const raw = {
    city: "CP",
    neighborhood: "Jd. Guanabara",
    researchedAt: "2026-10-19",
    numbers: [
      { metric: "population density", value: 112.5, unit: "hab/ha", year: 2022, scope: "bairro", source: "IBGE", url: url(1) },
      { metric: "share_apartments", value: 63.5, unit: "%", year: 2022, scope: "bairro", source: "IBGE" },
    ],
    crime: { officialUnit: "SSP-SP 4º DP", summary: "Resumo.", series: [] },
    opinions: [
      ...Array.from({ length: 3 }, (_, i) => ({ stance: "positive", theme: `t${i}`, quote: `bom ${i}`, source: "r/campinas", url: url(10 + i) })),
      ...Array.from({ length: 3 }, (_, i) => ({ stance: "negative", theme: `t${i}`, quote: `ruim ${i}`, source: "r/campinas (u/x)", url: url(20 + i) })),
      { stance: "mixed", theme: "x", quote: "sem link", source: "r/campinas" },
    ],
    news: Array.from({ length: 7 }, (_, i) => ({ date: `2026-0${i + 1}-01`, headline: `N${i}`, outlet: "G1", url: url(30 + i) })),
    facts: [],
    highlights: ["Destaque"],
    redFlags: ["Alerta"],
    gaps: ["Lacuna"],
    marista: { score_0_10: 4, why: "juízo" },
  };
  const rubric = [
    { city: "CP", neighborhood: "Jardim Guanabara", total_0_10: 3.2, measured_share: 0.6, criteria: { arborização: { score: 4, evidence: ["OSM https://osm.org/x"] } } },
  ];

  it("keys by the catalog key, attaches the rubric through aliases and trims lists", () => {
    const built = buildResearchFile([raw], rubric, "2026-10-19T00:00:00.000Z");
    const d = built.dossiers["CP:Jd. Guanabara"]!;
    expect(Object.keys(built.dossiers)).toEqual(["CP:Jd. Guanabara"]);
    expect(d.numbers).toEqual([expect.objectContaining({ metric: "density", value: 11250, unit: "hab/km²" })]);
    expect(d.opinions).toHaveLength(4);
    expect(d.opinions.map((o) => o.stance)).toEqual(["positive", "negative", "positive", "negative"]);
    expect(d.opinions.every((o) => !o.source.includes("u/"))).toBe(true);
    expect(d.news.map((n) => n.headline)).toEqual(["N6", "N5", "N4", "N3", "N2"]);
    expect(d.rubric).toEqual({
      total: 3.2,
      measuredShare: 0.6,
      criteria: [{ name: "arborização", score: 4, evidence: [{ text: "OSM https://osm.org/x", url: "https://osm.org/x" }] }],
    });
    expect(d.maristaJudgement).toEqual({ score: 4, why: "juízo" });
  });

  it("reads the wrapped rubric format with full city names and criterion labels", () => {
    const wrapped = {
      neighborhoods: [
        {
          city: "Campinas",
          neighborhood: "Jd. Guanabara",
          total_0_10: 3.1,
          measured_share: 0.5,
          criteria: { relevo_plano: { name: "Relevo plano", basis: "measured", score: 6, evidence: [{ text: "Declive", url: url(99) }] } },
        },
      ],
    };
    const d = buildResearchFile([raw], wrapped).dossiers["CP:Jd. Guanabara"]!;
    expect(d.rubric?.total).toBe(3.1);
    expect(d.rubric?.criteria).toEqual([
      { name: "Relevo plano", basis: "measured", score: 6, evidence: [{ text: "Declive", url: url(99) }] },
    ]);
  });

  it("leaves the rubric null when there is no rubric file", () => {
    expect(buildResearchFile([raw], []).dossiers["CP:Jd. Guanabara"]!.rubric).toBeNull();
  });
});
