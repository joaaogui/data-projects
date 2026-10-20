import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatQolValue, QOL_COLUMNS, qolRow } from "./neighborhood-qol";
import type { NeighborhoodQol, QolMetric } from "@/types/neighborhood-research";

const metric = (value: number | null, extra: Partial<QolMetric> = {}): QolMetric => ({
  value,
  unit: "",
  year: "2022",
  scope: "bairro IBGE Moema",
  source: "IBGE",
  url: "https://example.com",
  ...extra,
});

const QOL: NeighborhoodQol = {
  cityRef: "SP",
  metrics: {
    idhm: metric(0.9531, { year: "2010", scope: "UDH Moema [1355030830010, POP2010 28709]", cityValue: 0.805 }),
    life_expectancy: metric(78.42, { year: "2010", cityValue: 76.3 }),
    income_household_head_2022: metric(13912, { scope: "distrito Moema inteiro", cityValue: 4961.95 }),
    crime_robbery: metric(905, { scope: "27º DP Campo Belo", ratio: 1.08, cityValue: 836.8, count: 1414, year: "set/2025–ago/2026" }),
    crime_homicide: metric(5.5, { scope: "27º DP", ratio: 1.35, count: 6, note: "Contagem baixa, taxa instável." }),
    park_area_1km_ha: metric(6.6, { scope: "raio de 1 km" }),
    nearest_large_park_m: metric(884, {
      park: { name: "Estação Ecológica do Cercadinho", ha: 227.8, url: "https://osm.org/w/1", accessNote: "visitação restrita" },
    }),
    street_trees_faces: metric(88.36, { cityValue: 55.02 }),
    sewer_network: null,
  },
};

describe("qolRow", () => {
  const row = qolRow(QOL);

  it("formats each column in pt-BR", () => {
    expect(row.idhm?.text).toBe("0,953");
    expect(row.lifeExpectancy?.text).toBe("78,4 anos");
    expect(row.income?.text).toBe("R$ 13,9 mil");
    expect(row.robbery?.text).toBe("1,1×");
    expect(row.trees?.text).toBe("88,4%");
    expect(formatQolValue("sewer_network", 99.99)).toBe("100%");
  });

  it("puts the scope and the city value in the cell tooltip, without Atlas UDH codes", () => {
    expect(row.idhm?.hint).toBe("UDH Moema · São Paulo: 0,805");
    expect(row.income?.hint).toBe("distrito Moema inteiro · São Paulo: R$ 5,0 mil");
    expect(row.robbery?.hint).toContain("27º DP Campo Belo");
    expect(row.robbery?.hint).toContain("vs São Paulo: 836,8/100 mil");
  });

  it("flags small homicide counts and restricted-access parks with * and says why", () => {
    expect(row.homicide?.text).toBe("1,4×*");
    expect(row.homicide?.hint).toContain("contagem baixa (6 casos): taxa instável");
    expect(row.parks?.text).toBe("6,6 ha*");
    expect(row.parks?.hint).toContain("Estação Ecológica do Cercadinho (227,8 ha) a 884 m");
    expect(row.parks?.hint).toContain("visitação restrita");
  });

  it("shows — with the null reason, and leaves out metrics without data", () => {
    const campinas = qolRow({
      cityRef: "CP",
      metrics: { crime_robbery: metric(null, { scope: "10º DP", ratio: null, reason: "Sem população por DP" }) },
    });
    expect(campinas.robbery).toEqual({ value: null, text: "—", hint: "Sem população por DP · 10º DP" });
    expect(row.sewer).toBeUndefined();
  });
});

describe("QOL_COLUMNS headers", () => {
  it("give each column a definition, a year and a source", () => {
    const title = (id: string) => QOL_COLUMNS.find((c) => c.id === id)!.title;
    expect(title("idhm")).toMatch(/2010.*Atlas/);
    expect(title("income")).toMatch(/responsável.*2022.*IBGE/);
    expect(title("robbery")).toMatch(/diferem por estado.*mesma cidade/);
    expect(title("homicide")).toMatch(/instável/);
    for (const c of QOL_COLUMNS) expect(c.title).toContain("não entra em nenhuma nota");
  });
});

describe("display only", () => {
  it("the scoring engine never reads the quality-of-life data", () => {
    const engine = readFileSync(join(__dirname, "scoring-engine.ts"), "utf8");
    expect(engine).not.toMatch(/qol|neighborhood-qol/i);
  });
});
