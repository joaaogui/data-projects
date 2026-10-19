import { describe, expect, it } from "vitest";

import {
  getNeighborhoodDossier,
  getNeighborhoodSummary,
  withNeighborhoodResearch,
} from "./neighborhood-research";

describe("neighborhood research (committed data)", () => {
  it("finds dossiers by catalog key or listing alias", () => {
    expect(getNeighborhoodDossier("BH:Lourdes")?.key).toBe("BH:Lourdes");
    expect(getNeighborhoodDossier("CP:Jardim Guanabara")?.key).toBe("CP:Jd. Guanabara");
    expect(getNeighborhoodDossier("RJ:Botafogo")?.key).toBe("RJ:Botafogo (Orla)");
    expect(getNeighborhoodDossier("CP:Botafogo")).toBeNull();
    expect(getNeighborhoodDossier("Lourdes")).toBeNull();
  });

  it("builds a card-sized summary", () => {
    const s = getNeighborhoodSummary("CP", "Taquaral")!;
    expect(s.key).toBe("CP:Taquaral");
    expect(s.densityPerKm2).toBeGreaterThan(1000);
    expect(s.highlight).toBeTruthy();
    expect(s.redFlag).toBeTruthy();
    expect(JSON.stringify(s).length).toBeLessThan(400);
  });

  it("only decorates researched listings", () => {
    const [a, b] = withNeighborhoodResearch([
      { cityCode: "BH", neighborhood: "Lourdes" },
      { cityCode: "SP", neighborhood: "Pinheiros" },
    ]);
    expect(a!.neighborhoodResearch?.key).toBe("BH:Lourdes");
    expect(b).not.toHaveProperty("neighborhoodResearch");
  });
});
