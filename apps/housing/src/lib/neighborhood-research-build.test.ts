import { describe, expect, it } from "vitest";

import qolJson from "@/data/neighborhood-qol.json";
import researchJson from "@/data/neighborhood-research.json";
import type { NeighborhoodResearchFile } from "@/types/neighborhood-research";

import {
  attachQol,
  attachRationales,
  buildResearchFile,
  cityRatio,
  crimeScope,
  researchKey,
  resolveQolKey,
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

  it("reads a round-2 dossier's own rubric block (total_0_10 or total) ahead of the rubric file", () => {
    const inline = { ...raw, rubric: { total_0_10: 6.1, measured_share: 0.8, criteria: { x: { name: "X", score: 7, evidence: [] } } } };
    expect(buildResearchFile([inline], rubric).dossiers["CP:Jd. Guanabara"]!.rubric).toEqual({
      total: 6.1,
      measuredShare: 0.8,
      criteria: [{ name: "X", score: 7, evidence: [] }],
    });
    const legacy = { ...raw, rubric: { total: 5.5, criteria: {} } };
    expect(buildResearchFile([legacy], []).dossiers["CP:Jd. Guanabara"]!.rubric?.total).toBe(5.5);
    const noTotal = { ...raw, rubric: { criteria: {} } };
    expect(buildResearchFile([noTotal], rubric).dossiers["CP:Jd. Guanabara"]!.rubric?.total).toBe(3.2);
  });

  it("maps engine neighbourhoods covered by a combined dossier name onto it", () => {
    const built = buildResearchFile(
      [
        { ...raw, city: "BH", neighborhood: "Vila da Serra - Vale do Sereno" },
        { ...raw, city: "RJ", neighborhood: "Barra da Tijuca (Jardim Oceânico)" },
        { ...raw, city: "RJ", neighborhood: "Botafogo (Orla)" },
      ],
      [],
    );
    expect(built.aliases).toEqual({
      "BH:Vila da Serra": "BH:Vila da Serra - Vale do Sereno",
      "BH:Vale do Sereno": "BH:Vila da Serra - Vale do Sereno",
      "RJ:Jd. Oceânico": "RJ:Barra da Tijuca (Jardim Oceânico)",
    });
  });
});

describe("attachRationales", () => {
  const file = {
    builtAt: "2026-10-19T00:00:00.000Z",
    dossiers: { "BH:Carmo": {} },
    aliases: { "BH:Vale do Sereno": "BH:Vila da Serra - Vale do Sereno" },
  } as unknown as NeighborhoodResearchFile;
  const text = { shortRationale: " Curto. ", detailedJustification: "Longo." };

  it("keeps rationales whose key is a dossier or an alias, trimmed", () => {
    expect(attachRationales(file, { "BH:Carmo": text, "BH:Vale do Sereno": text }).rationales).toEqual({
      "BH:Carmo": { shortRationale: "Curto.", detailedJustification: "Longo." },
      "BH:Vale do Sereno": { shortRationale: "Curto.", detailedJustification: "Longo." },
    });
  });

  it("fails on a key without a dossier or with empty text", () => {
    expect(() => attachRationales(file, { "BH:Inexistente": text })).toThrow("BH:Inexistente: no dossier");
    expect(() => attachRationales(file, { "BH:Carmo": { ...text, shortRationale: " " } })).toThrow("empty text");
  });
});

describe("attachQol", () => {
  const file = {
    builtAt: "2026-10-19T00:00:00.000Z",
    dossiers: {
      "BH:Carmo": { key: "BH:Carmo" },
      "BH:Vila da Serra - Vale do Sereno": { key: "BH:Vila da Serra - Vale do Sereno" },
      "RJ:Tijuca (Pç Uruguai)": { key: "RJ:Tijuca (Pç Uruguai)" },
    },
    aliases: { "BH:Vale do Sereno": "BH:Vila da Serra - Vale do Sereno" },
  } as unknown as NeighborhoodResearchFile;
  const metric = (value: number | null, extra: Record<string, unknown> = {}) => ({
    value,
    unit: "%",
    year: 2022,
    scope: "bairro IBGE",
    source: "IBGE",
    url: "https://example.com/ibge",
    note: "x".repeat(400),
    ...extra,
  });

  it("resolves dossier keys, aliases and a dossier without its '(…)' suffix", () => {
    expect(resolveQolKey(file, "BH:Carmo")).toBe("BH:Carmo");
    expect(resolveQolKey(file, "BH:Vale do Sereno")).toBe("BH:Vila da Serra - Vale do Sereno");
    expect(resolveQolKey(file, "RJ:Tijuca")).toBe("RJ:Tijuca (Pç Uruguai)");
    expect(resolveQolKey(file, "BH:Inexistente")).toBeNull();
  });

  it("merges each neighbourhood's metrics into its dossier, trimmed, and leaves the rest untouched", () => {
    const out = attachQol(file, {
      neighborhoods: {
        "BH:Vale do Sereno": {
          cityRef: "NOVA_LIMA",
          sewer_network: metric(99.1, { cityValue: 90.2 }),
          crime_robbery: metric(null, { reason: "Sem população por DP", ratio: null, count: 119 }),
          nearest_large_park_m: metric(884, {
            park: { name: "Estação Ecológica", ha: 227.8, url: "https://osm.org/w/1", accessNote: "visitação restrita" },
          }),
          paved_road: null,
        },
        "RJ:Tijuca": { cityRef: "RJ", idhm: metric(0.892) },
      },
    });
    const qol = out.dossiers["BH:Vila da Serra - Vale do Sereno"]!.qol!;
    expect(qol.cityRef).toBe("NOVA_LIMA");
    expect(qol.metrics.sewer_network).toMatchObject({ value: 99.1, year: "2022", cityValue: 90.2, scope: "bairro IBGE" });
    expect(qol.metrics.sewer_network!.note!.length).toBeLessThanOrEqual(280);
    expect(qol.metrics.crime_robbery).toMatchObject({ value: null, reason: "Sem população por DP", ratio: null, count: 119 });
    expect(qol.metrics.nearest_large_park_m!.park).toEqual({
      name: "Estação Ecológica",
      ha: 227.8,
      url: "https://osm.org/w/1",
      accessNote: "visitação restrita",
    });
    expect(qol.metrics.paved_road).toBeNull();
    expect(out.dossiers["RJ:Tijuca (Pç Uruguai)"]!.qol!.metrics.idhm!.value).toBe(0.892);
    expect(out.dossiers["BH:Carmo"]!.qol).toBeUndefined();
    expect(file.dossiers["BH:Carmo"]!.qol).toBeUndefined();
  });

  it("fails on a key without a dossier or two keys on one dossier", () => {
    expect(() => attachQol(file, { neighborhoods: { "BH:Inexistente": { cityRef: "BH" } } })).toThrow(
      "qol BH:Inexistente: no dossier",
    );
    expect(() =>
      attachQol(file, {
        neighborhoods: { "BH:Vale do Sereno": { cityRef: "BH" }, "BH:Vila da Serra - Vale do Sereno": { cityRef: "BH" } },
      }),
    ).toThrow("already has qol");
  });
});

describe("committed research data", () => {
  it("carries the public quality-of-life metrics on every dossier, from the checked-in source", () => {
    const research = researchJson as unknown as NeighborhoodResearchFile;
    const source = qolJson as { neighborhoods: Record<string, unknown> };
    expect(Object.keys(source.neighborhoods)).toHaveLength(53);
    for (const qolKey of Object.keys(source.neighborhoods)) {
      const key = resolveQolKey(research, qolKey);
      expect(key, qolKey).not.toBeNull();
      expect(research.dossiers[key!]!.qol, qolKey).toBeDefined();
    }
    expect(research.dossiers["BH:Vila da Serra - Vale do Sereno"]!.qol!.cityRef).toBe("NOVA_LIMA");
    expect(research.dossiers["RJ:Tijuca (Pç Uruguai)"]!.qol!.metrics.idhm!.value).toBe(0.892);
  });
});
