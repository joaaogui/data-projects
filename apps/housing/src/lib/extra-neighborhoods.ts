import {
  computeWeightedNeighborhoodScore,
  DEFAULT_WEIGHTS,
  NEIGHBORHOOD_SAFETY_AND_METRICS,
  normalizeNeighborhoodKey,
  resolveNeighborhoodSafetyAndMetrics,
  type NeighborhoodSafetyMetrics,
} from "@/lib/scoring-engine";
import type { CityHubCode, NeighborhoodEntry } from "@/types/housing";
import type { NeighborhoodRationale } from "@/types/neighborhood-research";

const CITY_NAMES: Record<CityHubCode, string> = {
  BH: "Belo Horizonte",
  CP: "Campinas",
  RJ: "Rio de Janeiro",
  SP: "São Paulo",
  BSB: "Brasília",
};

/** Alias rows of the engine table are exact copies, so equal metrics mean the same neighbourhood. */
function metricsSignature(m: NeighborhoodSafetyMetrics): string {
  return [
    m.cityCode,
    m.commute,
    m.urbanBreathing,
    m.commuteLogistics,
    m.buildingStock,
    m.budgetFit,
    m.safetyCar,
  ].join("|");
}

/**
 * Neighbourhoods outside the catalog that have full sub-scores in NEIGHBORHOOD_SAFETY_AND_METRICS, at least
 * one active listing and pass `isResearched` (the server requires a research rubric: unresearched table values
 * run high). They only feed the ranking tab: listing scores and ranks keep using the catalog alone.
 */
export function buildExtraNeighborhoods(
  catalog: readonly NeighborhoodEntry[],
  listings: readonly { cityCode: CityHubCode; neighborhood: string; isActive?: boolean }[],
  isResearched: (cityCode: CityHubCode, neighborhood: string) => boolean,
  rationaleFor: (cityCode: CityHubCode, neighborhood: string) => NeighborhoodRationale | null = () => null,
): NeighborhoodEntry[] {
  const withListings = new Set<string>();
  for (const p of listings) {
    if (p.isActive === false) continue;
    const m = resolveNeighborhoodSafetyAndMetrics(p.cityCode, p.neighborhood);
    if (m) withListings.add(metricsSignature(m));
  }
  const seenKeys = new Set(
    catalog.map((n) => `${n.cityCode}:${normalizeNeighborhoodKey(n.neighborhood, n.cityCode)}`),
  );
  const seenSignatures = new Set<string>();
  for (const n of catalog) {
    const m = resolveNeighborhoodSafetyAndMetrics(n.cityCode, n.neighborhood);
    if (m) seenSignatures.add(metricsSignature(m));
  }
  const catalogByCity = new Map(catalog.map((n) => [n.cityCode, n]));

  const extras: NeighborhoodEntry[] = [];
  for (const [tableKey, m] of Object.entries(NEIGHBORHOOD_SAFETY_AND_METRICS)) {
    const name = normalizeNeighborhoodKey(tableKey.slice(tableKey.indexOf(":") + 1), m.cityCode);
    const key = `${m.cityCode}:${name}`;
    const signature = metricsSignature(m);
    if (seenKeys.has(key) || seenSignatures.has(signature)) continue;
    seenKeys.add(key);
    seenSignatures.add(signature);
    if (!withListings.has(signature) || !isResearched(m.cityCode, name)) continue;
    const sameCity = catalogByCity.get(m.cityCode);
    const scores = {
      urbanBreathing: m.urbanBreathing,
      commuteLogistics: m.commuteLogistics,
      buildingStock: m.buildingStock,
      budgetFit: m.budgetFit,
      safetyCar: m.safetyCar,
    };
    const rationale = rationaleFor(m.cityCode, name);
    extras.push({
      cityCode: m.cityCode,
      cityName: sameCity?.cityName ?? CITY_NAMES[m.cityCode],
      neighborhood: name,
      // After every catalog position, so score ties keep catalog rows first.
      overallPosition: catalog.length + extras.length + 1,
      cityPosition: 0,
      baseScore: computeWeightedNeighborhoodScore(scores, DEFAULT_WEIGHTS),
      idhm: 0,
      commuteTime: /^\d+(?:-\d+)?\s*min/.exec(m.commute)?.[0] ?? m.commute,
      nubankHub: sameCity?.nubankHub ?? "",
      urbanBreathingScore: m.urbanBreathing,
      commuteLogisticsScore: m.commuteLogistics,
      buildingStockFitScore: m.buildingStock,
      budgetFitScore: m.budgetFit,
      safetyCarScore: m.safetyCar,
      shortRationale: rationale?.shortRationale ?? "",
      detailedJustification: rationale?.detailedJustification ?? "",
      pros: [],
      cons: [],
      isExtra: true,
    });
  }
  return extras;
}
