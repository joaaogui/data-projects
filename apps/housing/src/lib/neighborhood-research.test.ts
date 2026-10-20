import { describe, expect, it } from "vitest";

import {
  getNeighborhoodDossier,
  getNeighborhoodQolRow,
  getNeighborhoodSummary,
  withNeighborhoodResearch,
} from "./neighborhood-research";
import { REFERENCE_NEIGHBORHOODS } from "./reference-neighborhood";
import { resolveNeighborhoodSafetyAndMetrics } from "./scoring-engine";

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

  it("gives the card the ranking table's Vida urbana: catalog row, reference row, else the engine table", () => {
    const ranked = [{ cityCode: "BH" as const, neighborhood: "Lourdes", urbanBreathingScore: 7.04 }];
    const [lourdes, marista, valeDoSereno] = withNeighborhoodResearch(
      [
        { cityCode: "BH", neighborhood: "Lourdes" },
        { cityCode: "GO", neighborhood: "Setor Marista" },
        { cityCode: "BH", neighborhood: "Vale do Sereno" },
      ],
      ranked,
    );
    expect(lourdes!.neighborhoodResearch?.urbanLife).toBe(7.04);
    expect(lourdes!.neighborhoodResearch?.marista).not.toBe(7.04);
    const ref = REFERENCE_NEIGHBORHOODS.find((r) => r.key === "GO:Setor Marista")!;
    expect(marista!.neighborhoodResearch?.urbanLife).toBe(ref.subScores.urbanBreathing);
    expect(valeDoSereno!.neighborhoodResearch?.urbanLife).toBe(
      resolveNeighborhoodSafetyAndMetrics("BH", "Vale do Sereno")!.urbanBreathing,
    );
  });

  it("gives the Top Bairros quality-of-life cells by row key, through aliases", () => {
    expect(getNeighborhoodQolRow("SP:Moema")?.idhm?.text).toBe("0,949");
    expect(getNeighborhoodQolRow("RJ:Tijuca (Pç Uruguai)")?.idhm?.text).toBe("0,892");
    expect(getNeighborhoodQolRow("BH:Vale do Sereno")).toEqual(getNeighborhoodQolRow("BH:Vila da Serra - Vale do Sereno"));
    expect(getNeighborhoodQolRow("GO:Setor Marista")?.income?.text).toBe("R$ 16,1 mil");
    expect(getNeighborhoodQolRow("BSB:Águas Claras")?.robbery?.text).toBe("0,3×");
    expect(getNeighborhoodQolRow("SP:Pinheiros")).toBeNull();
  });
});
