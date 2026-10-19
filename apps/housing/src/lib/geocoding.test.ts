import { describe, expect, it } from "vitest";
import {
  ALL_NUBANK_HUB_LOCATIONS,
  buildAddressCacheKey,
  computeDistanceKm,
  computeDistanceToNubankHubKm,
  findHospitalNoiseCluster,
  isCoordinateInsideCityBox,
  isNearTaquaralLagoa,
  NUBANK_HUBS,
  resolveNeighborhoodCenter,
} from "@/lib/geocoding";

describe("buildAddressCacheKey", () => {
  it("normalizes case, trims and collapses whitespace, keeping city prefix", () => {
    expect(
      buildAddressCacheKey({
        cityCode: "BH",
        neighborhood: "  Santa   Efigênia ",
        street: " Rua  Padre   Marinho ",
        streetNumber: " 318 ",
      }),
    ).toBe("BH|santa efigênia|rua padre marinho|318");
  });

  it("uses an empty segment for a missing street number and distinguishes numbers", () => {
    const base = { cityCode: "SP" as const, neighborhood: "Pinheiros", street: "Rua dos Pinheiros" };
    expect(buildAddressCacheKey({ ...base, streetNumber: null })).toBe(
      "SP|pinheiros|rua dos pinheiros|",
    );
    expect(buildAddressCacheKey({ ...base, streetNumber: "10" })).not.toBe(
      buildAddressCacheKey({ ...base, streetNumber: "20" }),
    );
    expect(buildAddressCacheKey({ ...base, cityCode: "RJ", streetNumber: "10" })).toContain("RJ|");
  });
});

describe("geocoding helpers", () => {
  it("rejects non-finite coordinates and accepts hub coordinates inside their city box", () => {
    expect(isCoordinateInsideCityBox("BH", Number.NaN, -43.9)).toBe(false);
    expect(isCoordinateInsideCityBox("BH", -19.9, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isCoordinateInsideCityBox("BH", NUBANK_HUBS.BH.lat, NUBANK_HUBS.BH.lng)).toBe(true);
    expect(isCoordinateInsideCityBox("BH", 0, 0)).toBe(false);
  });

  it("computes zero distance to itself and a positive hub distance", () => {
    expect(computeDistanceKm(-19.9, -43.9, -19.9, -43.9)).toBe(0);
    expect(computeDistanceToNubankHubKm("BH", NUBANK_HUBS.BH.lat, NUBANK_HUBS.BH.lng)).toBe(0);
    expect(computeDistanceToNubankHubKm("BH", -19.95, -43.95)).toBeGreaterThan(0);
  });

  it("resolves known neighborhood centers (accent-insensitive via normalization) and null for unknown", () => {
    expect(resolveNeighborhoodCenter("BH", "Funcionários")).not.toBeNull();
    expect(resolveNeighborhoodCenter("BH", "Bairro Inventado XYZ")).toBeNull();
  });

  it("flags hospital-noise streets only for the matching city/neighborhood/street", () => {
    expect(
      findHospitalNoiseCluster({
        cityCode: "BH",
        neighborhood: "Santa Efigênia",
        street: "Rua Padre Marinho",
      })?.name,
    ).toContain("Hospital");
    expect(
      findHospitalNoiseCluster({ cityCode: "BH", neighborhood: "Savassi", street: "Rua Padre Marinho" }),
    ).toBeNull();
    expect(
      findHospitalNoiseCluster({ cityCode: "SP", neighborhood: "Santa Efigênia", street: "Rua Padre Marinho" }),
    ).toBeNull();
  });

  it("marks only Taquaral listings on streets that run mostly by the lagoa as near the Lagoa do Taquaral", () => {
    const taq = (street: string, neighborhood = "Taquaral") =>
      isNearTaquaralLagoa({ cityCode: "CP", neighborhood, street });
    expect(taq("Rua Pedro Lopes")).toBe(true);
    expect(taq("Rua Eça de Queiroz", "Parque Taquaral")).toBe(true);
    expect(taq("Av. Dr. Heitor Penteado")).toBe(true);
    expect(taq("Rua Armando Sales de Oliveira")).toBe(true);
    for (const touchesLakeOnly of ["Rua Azarias de Melo", "Avenida Nossa Senhora de Fátima", "Avenida Barão de Itapura"]) {
      expect(taq(touchesLakeOnly), touchesLakeOnly).toBe(false);
    }
    expect(taq("Rua Alberto Cerqueira Lima")).toBe(false);
    expect(taq("Rua Otávio Machado")).toBe(false);
    expect(taq("Rua Paula Bueno")).toBe(false);
    expect(taq("Rua não informada")).toBe(false);
    expect(taq("")).toBe(false);
    expect(taq("Rua Pedro Lopes", "Jardim Guanabara")).toBe(false);
    expect(isNearTaquaralLagoa({ cityCode: "SP", neighborhood: "Taquaral", street: "Rua Pedro Lopes" })).toBe(false);
  });

  it("excludes the BSB benchmark hub from the real hub locations", () => {
    expect(ALL_NUBANK_HUB_LOCATIONS.every((h) => h.cityCode !== "BSB")).toBe(true);
    expect(ALL_NUBANK_HUB_LOCATIONS).toHaveLength(4);
  });
});
