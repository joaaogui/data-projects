import {
  classifyFurnitureTier,
  computeListingAge,
  hasActiveSaleListing,
  normalizeNeighborhoodKey,
  resolveCurrentPublicationIso,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  EvaluatedProperty,
  FurnitureTier,
  ModernityTier,
} from "@/types/housing";

export function isRecentlyPublishedListing(
  prop: Pick<EvaluatedProperty, "listingAgeDays" | "isNewEntry">,
): boolean {
  return prop.listingAgeDays !== null && prop.listingAgeDays !== undefined
    ? prop.listingAgeDays <= 5
    : Boolean(prop.isNewEntry);
}

export type FloorFilterOption =
  | "ALL"
  | "HIGH_OR_TOP"
  | "LEGENDARY"
  | "EPIC"
  | "RARE"
  | "UNCOMMON"
  | "NO_GROUND";

export type SortByOption =
  | "score_desc"
  | "score_asc"
  | "price_asc"
  | "price_desc"
  | "rent_asc"
  | "rent_desc"
  | "area_desc"
  | "modernity_desc"
  | "price_per_m2_asc"
  | "floor_desc"
  | "commute_asc"
  | "age_asc"
  | "age_desc";

export type FurnishedFilterOption =
  | "ALL"
  | "UNFURNISHED"
  | "UNFURNISHED_OR_SEMI"
  | "SEMI_FURNISHED"
  | "FURNISHED";

export type ProviderFilterOption =
  | "ALL"
  | "quintoandar"
  | "zapimoveis"
  | "vivareal"
  | "netimoveis"
  | "imovelweb";

export type DeactivatedFilterOption =
  | "ACTIVE_ONLY"
  | "ALL"
  | "DEACTIVATED_ONLY";

export type PropertyFeatureKey =
  | "ac"
  | "free_view_sun"
  | "reserved_building"
  | "new_building"
  | "balcony"
  | "suite"
  | "doorman_24h"
  | "pool_gym"
  | "pets"
  | "safe_street";

export interface PropertyExplorerFilters {
  selectedCity?: CityHubCode | "ALL";
  selectedCities?: CityHubCode[];
  searchQuery: string;
  floorFilter?: FloorFilterOption;
  floorFilters?: FloorFilterOption[];
  minTotalMonthly: number | null;
  maxTotalMonthly: number | null;
  maxCommuteMinutes?: number | null;
  minScore: number | null;
  sortBy: SortByOption;
  selectedNeighborhoods: string[];
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minListingAgeDays?: number | null;
  maxListingAgeDays?: number | null;
  listingDateFrom?: string;
  listingDateTo?: string;
  selectedBedrooms?: number[];
  selectedBathrooms?: number[];
  selectedParking?: number[];
  minBedrooms?: number | null;
  minBathrooms?: number | null;
  minParking?: number | null;
  modernityTiers: ModernityTier[];
  minModernityScore: number | null;
  furnishedFilter?: FurnishedFilterOption;
  selectedFurnitureTiers?: FurnitureTier[];
  requiredFeatures: PropertyFeatureKey[];
  hideMegaCondo: boolean;
  hideForSale: boolean;
  onlyNewEntries: boolean;
  showIneligible: boolean;
  onlyIneligible?: boolean;
  providerFilter: ProviderFilterOption;
  onlyFavorites: boolean;
  onlyTop20Neighborhoods?: boolean;
  onlySafeStreets?: boolean;
  enableBsbBenchmark?: boolean;
  deactivatedFilter: DeactivatedFilterOption;
  favoriteKeys?: string[];
}

export const DEFAULT_EXPLORER_FILTERS: PropertyExplorerFilters = {
  selectedCity: "ALL",
  selectedCities: [],
  searchQuery: "",
  floorFilter: "ALL",
  floorFilters: [],
  minTotalMonthly: null,
  maxTotalMonthly: null,
  maxCommuteMinutes: null,
  minScore: null,
  sortBy: "score_desc",
  selectedNeighborhoods: [],
  minAreaM2: null,
  maxAreaM2: null,
  minListingAgeDays: null,
  maxListingAgeDays: null,
  listingDateFrom: "",
  listingDateTo: "",
  selectedBedrooms: [],
  selectedBathrooms: [],
  selectedParking: [],
  minBedrooms: null,
  minBathrooms: null,
  minParking: null,
  modernityTiers: [],
  minModernityScore: null,
  furnishedFilter: "ALL",
  selectedFurnitureTiers: [],
  requiredFeatures: [],
  hideMegaCondo: false,
  hideForSale: false,
  onlyNewEntries: false,
  showIneligible: false,
  onlyIneligible: false,
  providerFilter: "ALL",
  onlyFavorites: false,
  onlyTop20Neighborhoods: false,
  onlySafeStreets: false,
  enableBsbBenchmark: false,
  deactivatedFilter: "ACTIVE_ONLY",
  favoriteKeys: [],
};

export const PERFEITO_EXPLORER_FILTERS: Partial<PropertyExplorerFilters> = {
  requiredFeatures: ["ac"],
  floorFilters: ["HIGH_OR_TOP"],
  minTotalMonthly: null,
  maxTotalMonthly: 4500,
  maxCommuteMinutes: 25,
  selectedFurnitureTiers: ["UNFURNISHED"],
  furnishedFilter: "UNFURNISHED",
  onlySafeStreets: true,
};

export const FLOOR_FILTER_OPTIONS: {
  value: FloorFilterOption;
  label: string;
  shortLabel: string;
}[] = [
  { value: "ALL", label: "Qualquer andar", shortLabel: "Qualquer" },
  {
    value: "HIGH_OR_TOP",
    label: "Andar Alto / Cobertura",
    shortLabel: "Alto / Cobertura",
  },
  {
    value: "LEGENDARY",
    label: "Só Cobertura / Último",
    shortLabel: "Só Cobertura / Último",
  },
  {
    value: "EPIC",
    label: "Andar Alto (8º+)",
    shortLabel: "Alto (8º+)",
  },
  {
    value: "RARE",
    label: "Andar Médio (4º–7º)",
    shortLabel: "Médio (4º–7º)",
  },
  {
    value: "UNCOMMON",
    label: "Andar Baixo (1º–3º)",
    shortLabel: "Baixo (1º–3º)",
  },
  {
    value: "NO_GROUND",
    label: "Excluir Térreo",
    shortLabel: "Sem Térreo",
  },
];

export const SORT_BY_OPTIONS: {
  value: SortByOption;
  label: string;
  shortLabel: string;
}[] = [
  { value: "score_desc", label: "Maior Nota (Score)", shortLabel: "Nota ↓" },
  { value: "score_asc", label: "Menor Nota (Score)", shortLabel: "Nota ↑" },
  {
    value: "price_asc",
    label: "Menor Preço Total (R$)",
    shortLabel: "Preço ↑",
  },
  {
    value: "price_desc",
    label: "Maior Preço Total (R$)",
    shortLabel: "Preço ↓",
  },
  {
    value: "rent_asc",
    label: "Menor Aluguel Base (R$)",
    shortLabel: "Aluguel ↑",
  },
  {
    value: "rent_desc",
    label: "Maior Aluguel Base (R$)",
    shortLabel: "Aluguel ↓",
  },
  { value: "floor_desc", label: "Andar Mais Alto", shortLabel: "Andar ↓" },
  { value: "area_desc", label: "Maior Área (m²)", shortLabel: "Área ↓" },
  {
    value: "modernity_desc",
    label: "Maior Modernidade",
    shortLabel: "Moderno ↓",
  },
  { value: "price_per_m2_asc", label: "Melhor R$/m²", shortLabel: "R$/m² ↑" },
  {
    value: "commute_asc",
    label: "Menor Tempo até o Escritório (min)",
    shortLabel: "Tempo ↑",
  },
  {
    value: "age_asc",
    label: "Anúncio Mais Recente (Menor Idade)",
    shortLabel: "Mais Recente",
  },
  {
    value: "age_desc",
    label: "Anúncio Mais Antigo (Maior Idade)",
    shortLabel: "Mais Antigo",
  },
];

export const PROPERTY_FEATURE_OPTIONS: {
  key: PropertyFeatureKey;
  label: string;
}[] = [
  { key: "ac", label: "Ar-condicionado" },
  { key: "free_view_sun", label: "Vista livre" },
  { key: "reserved_building", label: "Torre única / Reservado" },
  { key: "new_building", label: "Prédio Novo (2010+)" },
  { key: "balcony", label: "Varanda / Sacada" },
  { key: "suite", label: "Suíte" },
  { key: "doorman_24h", label: "Portaria 24h" },
  { key: "pool_gym", label: "Piscina / Academia" },
  { key: "pets", label: "Aceita Pet" },
  { key: "safe_street", label: "Sem problemas de segurança" },
];

export function hasNoSafetyProblems(prop: EvaluatedProperty): boolean {
  if (
    prop.cardTags.redTags.includes("Alerta de Segurança na Rua") ||
    prop.cardTags.redTags.includes("Via Arterial / Efeito Bunker")
  ) {
    return false;
  }
  if ((prop.breakdown?.safetyPoints ?? 0) < 0) {
    return false;
  }
  return true;
}

export function matchesFloorFilter(
  prop: EvaluatedProperty,
  floorFilter: FloorFilterOption | FloorFilterOption[],
): boolean {
  if (Array.isArray(floorFilter)) {
    const active = floorFilter.filter((f) => f !== "ALL");
    if (active.length === 0) return true;
    if (active.includes("NO_GROUND") && !matchesFloorFilter(prop, "NO_GROUND")) {
      return false;
    }
    const tierSelectors = active.filter((f) => f !== "NO_GROUND");
    if (tierSelectors.length > 0) {
      return tierSelectors.some((f) => matchesFloorFilter(prop, f));
    }
    return true;
  }
  if (floorFilter === "ALL") return true;
  const rarity = prop.cardTags.floorTag?.rarity ?? null;
  if (floorFilter === "HIGH_OR_TOP") {
    return rarity === "legendary" || rarity === "epic";
  }
  if (floorFilter === "LEGENDARY") {
    return rarity === "legendary";
  }
  if (floorFilter === "EPIC") {
    return rarity === "epic";
  }
  if (floorFilter === "RARE") {
    return rarity === "rare";
  }
  if (floorFilter === "UNCOMMON") {
    return rarity === "uncommon";
  }
  if (floorFilter === "NO_GROUND") {
    return rarity !== "common" && prop.floor !== 0;
  }
  return true;
}

const featureTextCache = new WeakMap<object, string>();
const searchHaystackCache = new WeakMap<object, string>();
const forSaleFlagCache = new WeakMap<object, boolean>();

function getCachedFeatureText(prop: EvaluatedProperty): string {
  const hit = featureTextCache.get(prop);
  if (hit !== undefined) return hit;
  const text = [
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
    ...(prop.installations ?? []),
    ...(prop.amenities ?? []),
    ...(prop.comfortCommodities ?? []),
    ...(prop.practicalityCommodities ?? []),
    ...(prop.positiveSignals ?? []),
    ...(prop.photoCaptions ?? []),
  ]
    .join(" ")
    .toLowerCase();
  featureTextCache.set(prop, text);
  return text;
}

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getCachedSearchHaystack(prop: EvaluatedProperty): string {
  const hit = searchHaystackCache.get(prop);
  if (hit !== undefined) return hit;
  const hay = stripDiacritics(
    [
      prop.neighborhood,
      prop.street,
      prop.condominiumName ?? "",
      prop.title,
      prop.description ?? "",
      prop.generatedDescription ?? "",
      ...prop.positiveSignals,
      ...prop.nuanceHighlights,
      ...prop.installations,
      ...prop.amenities,
      ...prop.comfortCommodities,
      ...prop.practicalityCommodities,
      ...prop.placesNearby.map((pl) => pl.name),
      prop.id,
    ]
      .join(" ")
      .toLowerCase(),
  );
  searchHaystackCache.set(prop, hay);
  return hay;
}

function getCachedForSaleFlag(prop: EvaluatedProperty): boolean {
  const hit = forSaleFlagCache.get(prop);
  if (hit !== undefined) return hit;
  const isForSale = hasActiveSaleListing(prop);
  forSaleFlagCache.set(prop, isForSale);
  return isForSale;
}

export function matchesPropertyFeature(
  prop: EvaluatedProperty,
  feature: PropertyFeatureKey,
): boolean {
  switch (feature) {
    case "ac":
      return prop.cardTags.acLabel !== null;
    case "free_view_sun":
      return (
        prop.cardTags.greenTags.some(
          (t) => t.includes("Vista livre") || t.includes("Sol da manhã"),
        ) ||
        prop.nuanceHighlights.some(
          (h) => h.includes("Vista livre") || h.includes("Sol da manhã"),
        )
      );
    case "reserved_building":
      return (
        prop.cardTags.greenTags.includes("Torre única / Reservado") ||
        prop.nuanceHighlights.includes("Torre única / Prédio reservado")
      );
    case "new_building":
      return (
        (prop.constructionYear !== null && prop.constructionYear >= 2010) ||
        prop.cardTags.greenTags.some((t) => t.startsWith("Prédio Novo"))
      );
    case "balcony":
      return (
        prop.nuanceHighlights.includes("Varanda") ||
        /\b(varanda|sacada|balcony)\b/i.test(getCachedFeatureText(prop))
      );
    case "suite":
      return (
        prop.suites >= 1 || /\bsu[ií]tes?\b/i.test(getCachedFeatureText(prop))
      );
    case "doorman_24h":
      return (
        prop.doorman !== "NotAvailable" &&
        (prop.doorman === "NightAndDayShift" ||
          prop.doorman === "24h" ||
          /\b(portaria_24h|concierge_24h|(?:portaria|porteiro|guarita|portaria remota) 24(?:h|\s*horas)?)\b/i.test(
            getCachedFeatureText(prop),
          ))
      );
    case "pool_gym":
      return /\b(piscina|academia|fitness|gym|pool)\b/i.test(
        getCachedFeatureText(prop),
      );
    case "pets":
      return prop.acceptsPets === true;
    case "safe_street":
      return hasNoSafetyProblems(prop);
  }
}

export function getEffectiveFloorSortValue(prop: EvaluatedProperty): number {
  const rarity = prop.cardTags.floorTag?.rarity ?? null;
  const legendaryBonus = rarity === "legendary" ? 100 : 0;
  if (prop.floor !== null) {
    return legendaryBonus + prop.floor;
  }
  if (prop.floorRange !== null) {
    return legendaryBonus + (prop.floorRange.min + prop.floorRange.max) / 2;
  }
  if (rarity === "legendary") return 120;
  if (rarity === "epic") return 12;
  if (rarity === "rare") return 5.5;
  if (rarity === "uncommon") return 2;
  if (rarity === "common") return 0;
  return -1;
}

export const STRICT_TOP_20_NEIGHBORHOODS_BY_CITY: Record<
  CityHubCode,
  ReadonlySet<string>
> = {
  BH: new Set([
    "lourdes",
    "funcionários",
    "funcionarios",
    "savassi",
    "santo agostinho",
    "sion",
    "santa efigênia",
    "santa efigenia",
    "vila da serra",
  ]),
  CP: new Set([
    "taquaral",
    "parque taquaral",
    "bosque",
    "jd. guanabara",
    "jardim guanabara",
    "guanabara",
    "nova campinas",
    "jd. chapadão",
    "jd. chapadao",
    "jardim chapadão",
    "jardim chapadao",
  ]),
  SP: new Set([
    "moema",
    "indianópolis",
    "indianopolis",
    "jardim paulista",
    "pinheiros",
    "alto de pinheiros",
    "sumaré",
    "sumare",
    "vila mariana",
  ]),
  RJ: new Set([
    "flamengo",
    "leme",
    "botafogo",
    "botafogo (orla)",
    "laranjeiras",
    "humaitá",
    "humaita",
    "ipanema",
    "leblon",
    "lagoa",
    "jardim botânico",
    "jardim botanico",
    "gavea",
    "gávea",
    "urca",
  ]),
  BSB: new Set([
    "águas claras",
    "aguas claras",
    "norte (águas claras)",
    "norte (aguas claras)",
    "sul (águas claras)",
    "sul (aguas claras)",
    "águas claras norte",
    "águas claras sul",
  ]),
};

const DEEP_WEST_BARRA_EXCLUSION_RE =
  /\b(barra ol[ií]mpica|estrada dos bandeirantes|shopping metropolitano|curicica|jacarepagu[aá]|recreio|riocentro|abelardo bueno|salvador allende|ad[ií]lio de oliveira|alfredo ceschiatti|franco zampari|m[aá]rio covas|jos[eé] wilker|besserman vianna|jos[eé] alencar|aroazes|c[eé]sar lattes|paulo moura|paulo viann?a|alfredo balthazar|jaime poggi|clementina de jesus|sylvio da rocha pollis)\b/i;

export function isStrictlyInTop20Neighborhoods(
  prop: Pick<
    EvaluatedProperty,
    "cityCode" | "neighborhood" | "street" | "title" | "description"
  >,
): boolean {
  const allowedSet = STRICT_TOP_20_NEIGHBORHOODS_BY_CITY[prop.cityCode];
  if (!allowedSet) return false;

  const rawNb = (prop.neighborhood ?? "").trim().toLowerCase();
  const normNb = normalizeNeighborhoodKey(
    prop.neighborhood ?? "",
    prop.cityCode,
  ).toLowerCase();

  if (!allowedSet.has(rawNb) && !allowedSet.has(normNb)) {
    return false;
  }

  // In RJ, if the portal labeled the listing as "Barra da Tijuca" or "Jd. Oceânico",
  // reject sub-areas that are actually Barra Olímpica, Curicica, Jacarepaguá, or Recreio.
  if (prop.cityCode === "RJ" && normNb === "jd. oceânico") {
    const fullLocationText = `${prop.neighborhood ?? ""} ${prop.street ?? ""} ${prop.title ?? ""} ${prop.description ?? ""}`;
    if (DEEP_WEST_BARRA_EXCLUSION_RE.test(fullLocationText)) {
      return false;
    }
  }

  return true;
}

export function resolvePropertyListingAgeAndDate(p: EvaluatedProperty): {
  ageDays: number | null;
  dateIso: string | null;
} {
  const ext = p as EvaluatedProperty & {
    listingPublishedAt?: string | null;
    firstSeenAt?: string | null;
  };
  const rawIso = (
    ext.listingPublishedAt ??
    resolveCurrentPublicationIso(p) ??
    ext.firstSeenAt ??
    ""
  ).trim();

  const ageDays =
    p.listingAgeDays !== undefined && p.listingAgeDays !== null
      ? p.listingAgeDays
      : rawIso
        ? computeListingAge(rawIso).days
        : null;

  let dateIso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(rawIso)) {
    dateIso = rawIso.slice(0, 10);
  } else if (rawIso) {
    const parsedMs = Date.parse(rawIso);
    if (Number.isFinite(parsedMs)) {
      dateIso = new Date(parsedMs).toISOString().slice(0, 10);
    }
  }
  if (
    !dateIso &&
    ageDays !== null &&
    ageDays !== undefined &&
    Number.isFinite(ageDays)
  ) {
    dateIso = new Date(Date.now() - ageDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }

  return { ageDays: ageDays ?? null, dateIso };
}

export function filterAndSortProperties(
  properties: EvaluatedProperty[],
  filters: PropertyExplorerFilters,
  favoriteKeysArg?: Iterable<string>,
): EvaluatedProperty[] {
  const q = stripDiacritics(filters.searchQuery.trim().toLowerCase());
  const favSet = new Set<string>([
    ...(filters.favoriteKeys ?? []),
    ...(favoriteKeysArg ?? []),
  ]);
  const onlyFavorites = filters.onlyFavorites ?? false;
  const enableBsbBenchmark = filters.enableBsbBenchmark ?? false;
  const deactivatedFilter: DeactivatedFilterOption =
    filters.deactivatedFilter ?? "ACTIVE_ONLY";
  const activeFurnitureTiers =
    filters.selectedFurnitureTiers &&
    filters.selectedFurnitureTiers.length > 0
      ? filters.selectedFurnitureTiers
      : null;
  const allowFullyFurnishedIneligible = activeFurnitureTiers
    ? activeFurnitureTiers.includes("FULLY_FURNISHED")
    : filters.furnishedFilter === "FURNISHED";
  const allowCommuteBottleneckIneligible =
    filters.selectedNeighborhoods.length > 0 ||
    (filters.maxCommuteMinutes !== null &&
      filters.maxCommuteMinutes !== undefined &&
      filters.maxCommuteMinutes >= 40);

  const filtered = properties.filter((p) => {
    if (!enableBsbBenchmark && p.cityCode === "BSB") {
      return false;
    }

    const propKey = `${p.provider}:${p.id}`;
    const isFav = favSet.has(propKey) || favSet.has(p.id);
    const isActive = p.isActive !== false;

    if (onlyFavorites && !isFav) {
      return false;
    }

    // Important UX rule: when onlyFavorites === true, show ALL favorited properties
    // including deactivated ones by default unless user explicitly chose DEACTIVATED_ONLY.
    if (deactivatedFilter === "DEACTIVATED_ONLY") {
      if (isActive) return false;
    } else if (deactivatedFilter === "ACTIVE_ONLY" && !onlyFavorites) {
      if (!isActive) return false;
      if (
        (!p.samplePhotos || p.samplePhotos.length === 0) &&
        (p.photosCount ?? 0) === 0
      ) {
        return false;
      }
    }

    const activeCities =
      filters.selectedCities &&
      filters.selectedCities.length > 0 &&
      (enableBsbBenchmark || filters.selectedCities.length < 4)
        ? filters.selectedCities
        : filters.selectedCity && filters.selectedCity !== "ALL"
          ? [filters.selectedCity]
          : null;
    if (activeCities && !activeCities.includes(p.cityCode)) {
      return false;
    }
    if (
      filters.onlyTop20Neighborhoods &&
      !isStrictlyInTop20Neighborhoods(p)
    ) {
      return false;
    }
    if (filters.selectedNeighborhoods.length > 0) {
      const normNb = normalizeNeighborhoodKey(p.neighborhood, p.cityCode);
      const matchesNb = filters.selectedNeighborhoods.some((sel) => {
        if (sel.includes(":")) {
          const selLower = sel.toLowerCase();
          return (
            selLower === `${p.cityCode}:${p.neighborhood}`.toLowerCase() ||
            selLower === `${p.cityCode}:${normNb}`.toLowerCase()
          );
        }
        return (
          sel === p.neighborhood ||
          normalizeNeighborhoodKey(sel, p.cityCode) === normNb
        );
      });
      if (!matchesNb) {
        return false;
      }
    }
    if (filters.onlyIneligible && p.eligible) {
      return false;
    }
    const furnitureTier = p.furnitureTier ?? classifyFurnitureTier(p);
    const exclusionParts = p.exclusionReason
      ? p.exclusionReason.split(" · ")
      : [];
    const isAllowedIneligibleOverride =
      !p.eligible &&
      exclusionParts.length > 0 &&
      exclusionParts.every(
        (reason) =>
          (allowFullyFurnishedIneligible &&
            furnitureTier === "FULLY_FURNISHED" &&
            /totalmente mobiliado/i.test(reason)) ||
          (allowCommuteBottleneckIneligible &&
            /(?:gargalo pendular cr[ií]tico|tempo at[eé] o escrit[oó]rio.*acima do limite de 50 min)/i.test(
              reason,
            )),
      );
    if (
      !filters.showIneligible &&
      !filters.onlyIneligible &&
      !onlyFavorites &&
      !p.eligible &&
      !isAllowedIneligibleOverride
    ) {
      return false;
    }
    const activeFloorFilters: FloorFilterOption[] =
      filters.floorFilters && filters.floorFilters.length > 0
        ? filters.floorFilters.filter((f) => f !== "ALL")
        : filters.floorFilter && filters.floorFilter !== "ALL"
          ? [filters.floorFilter]
          : [];
    if (activeFloorFilters.length > 0 && !matchesFloorFilter(p, activeFloorFilters)) {
      return false;
    }
    if (
      filters.minTotalMonthly !== null &&
      p.totalMonthly < filters.minTotalMonthly
    ) {
      return false;
    }
    if (
      filters.maxTotalMonthly !== null &&
      p.totalMonthly > filters.maxTotalMonthly
    ) {
      return false;
    }
    if (
      filters.maxCommuteMinutes !== null &&
      filters.maxCommuteMinutes !== undefined &&
      p.cityCode !== "BSB" &&
      p.commuteMinutes !== null &&
      p.commuteMinutes !== undefined &&
      p.commuteMinutes > filters.maxCommuteMinutes
    ) {
      return false;
    }
    if (filters.minScore !== null && p.finalScore < filters.minScore) {
      return false;
    }
    if (filters.minAreaM2 !== null && p.areaM2 < filters.minAreaM2) {
      return false;
    }
    if (filters.maxAreaM2 !== null && p.areaM2 > filters.maxAreaM2) {
      return false;
    }
    const minListingAgeDays = filters.minListingAgeDays ?? null;
    const maxListingAgeDays = filters.maxListingAgeDays ?? null;
    const listingDateFrom = (filters.listingDateFrom ?? "").trim();
    const listingDateTo = (filters.listingDateTo ?? "").trim();
    if (
      minListingAgeDays !== null ||
      maxListingAgeDays !== null ||
      listingDateFrom !== "" ||
      listingDateTo !== ""
    ) {
      const { ageDays, dateIso } = resolvePropertyListingAgeAndDate(p);
      if (
        minListingAgeDays !== null &&
        (ageDays === null || ageDays === undefined || ageDays < minListingAgeDays)
      ) {
        return false;
      }
      if (
        maxListingAgeDays !== null &&
        (ageDays === null || ageDays === undefined || ageDays > maxListingAgeDays)
      ) {
        return false;
      }
      if (listingDateFrom !== "" && (!dateIso || dateIso < listingDateFrom)) {
        return false;
      }
      if (listingDateTo !== "" && (!dateIso || dateIso > listingDateTo)) {
        return false;
      }
    }
    if (filters.selectedBedrooms && filters.selectedBedrooms.length > 0) {
      const matchesBed = filters.selectedBedrooms.some((b) =>
        b >= 3 ? p.bedrooms >= 3 : p.bedrooms === b,
      );
      if (!matchesBed) return false;
    } else if (
      filters.minBedrooms !== undefined &&
      filters.minBedrooms !== null &&
      p.bedrooms < filters.minBedrooms
    ) {
      return false;
    }
    if (filters.selectedBathrooms && filters.selectedBathrooms.length > 0) {
      const matchesBath = filters.selectedBathrooms.some((b) =>
        b >= 3 ? p.bathrooms >= 3 : p.bathrooms === b,
      );
      if (!matchesBath) return false;
    } else if (
      filters.minBathrooms !== undefined &&
      filters.minBathrooms !== null &&
      p.bathrooms < filters.minBathrooms
    ) {
      return false;
    }
    if (filters.selectedParking && filters.selectedParking.length > 0) {
      const matchesPark = filters.selectedParking.some((v) =>
        v >= 2 ? p.parkingSpaces >= 2 : p.parkingSpaces === v,
      );
      if (!matchesPark) return false;
    } else if (
      filters.minParking !== undefined &&
      filters.minParking !== null &&
      p.parkingSpaces < filters.minParking
    ) {
      return false;
    }
    if (
      filters.modernityTiers.length > 0 &&
      !filters.modernityTiers.includes(p.modernityTier)
    ) {
      return false;
    }
    if (
      filters.minModernityScore !== null &&
      p.modernityScore < filters.minModernityScore
    ) {
      return false;
    }
    if (activeFurnitureTiers) {
      if (!activeFurnitureTiers.includes(furnitureTier)) {
        return false;
      }
    } else {
      if (
        filters.furnishedFilter === "UNFURNISHED" &&
        furnitureTier !== "UNFURNISHED"
      ) {
        return false;
      }
      if (
        filters.furnishedFilter === "UNFURNISHED_OR_SEMI" &&
        furnitureTier === "FULLY_FURNISHED"
      ) {
        return false;
      }
      if (
        filters.furnishedFilter === "SEMI_FURNISHED" &&
        furnitureTier !== "SEMI_FURNISHED"
      ) {
        return false;
      }
      if (
        filters.furnishedFilter === "FURNISHED" &&
        furnitureTier !== "FULLY_FURNISHED" &&
        furnitureTier !== "SEMI_FURNISHED"
      ) {
        return false;
      }
    }
    if (filters.providerFilter !== "ALL") {
      if (filters.providerFilter === "zapimoveis") {
        if (p.provider !== "zapimoveis" && p.provider !== "zap") {
          return false;
        }
      } else if (p.provider !== filters.providerFilter) {
        return false;
      }
    }
    if (filters.onlyNewEntries && !isRecentlyPublishedListing(p)) {
      return false;
    }
    if (
      filters.hideMegaCondo &&
      (p.cardTags.redTags.includes("Megacondomínio") ||
        p.nuanceWarnings.some((w) => w.toLowerCase().includes("megacondomínio")))
    ) {
      return false;
    }
    if (filters.hideForSale) {
      if (getCachedForSaleFlag(p)) return false;
    }
    if (filters.onlySafeStreets && !hasNoSafetyProblems(p)) {
      return false;
    }
    if (filters.requiredFeatures.length > 0) {
      for (const feat of filters.requiredFeatures) {
        if (!matchesPropertyFeature(p, feat)) {
          return false;
        }
      }
    }
    if (q) {
      const hay = getCachedSearchHaystack(p);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    let cmp = 0;
    switch (filters.sortBy) {
      case "score_asc":
        cmp = a.finalScore - b.finalScore || a.totalMonthly - b.totalMonthly;
        break;
      case "price_asc":
        cmp = a.totalMonthly - b.totalMonthly || b.finalScore - a.finalScore;
        break;
      case "price_desc":
        cmp = b.totalMonthly - a.totalMonthly || b.finalScore - a.finalScore;
        break;
      case "rent_asc":
        cmp = a.rent - b.rent || b.finalScore - a.finalScore;
        break;
      case "rent_desc":
        cmp = b.rent - a.rent || b.finalScore - a.finalScore;
        break;
      case "area_desc":
        cmp = b.areaM2 - a.areaM2 || b.finalScore - a.finalScore;
        break;
      case "modernity_desc":
        cmp =
          b.modernityScore - a.modernityScore || b.finalScore - a.finalScore;
        break;
      case "price_per_m2_asc": {
        const aPm2 = a.totalMonthly / Math.max(1, a.areaM2);
        const bPm2 = b.totalMonthly / Math.max(1, b.areaM2);
        cmp = aPm2 - bPm2 || b.finalScore - a.finalScore;
        break;
      }
      case "floor_desc": {
        const aFl = getEffectiveFloorSortValue(a);
        const bFl = getEffectiveFloorSortValue(b);
        cmp = bFl - aFl || b.finalScore - a.finalScore;
        break;
      }
      case "commute_asc":
        cmp =
          (a.commuteMinutes ?? 99) - (b.commuteMinutes ?? 99) ||
          b.finalScore - a.finalScore;
        break;
      case "age_asc": {
        const aAge =
          a.listingAgeDays !== undefined
            ? a.listingAgeDays
            : computeListingAge(resolveCurrentPublicationIso(a)).days;
        const bAge =
          b.listingAgeDays !== undefined
            ? b.listingAgeDays
            : computeListingAge(resolveCurrentPublicationIso(b)).days;
        if (aAge === null && bAge === null) {
          cmp = b.finalScore - a.finalScore;
        } else if (aAge === null) {
          cmp = 1;
        } else if (bAge === null) {
          cmp = -1;
        } else {
          cmp = aAge - bAge || b.finalScore - a.finalScore;
        }
        break;
      }
      case "age_desc": {
        const aAge =
          a.listingAgeDays !== undefined
            ? a.listingAgeDays
            : computeListingAge(resolveCurrentPublicationIso(a)).days;
        const bAge =
          b.listingAgeDays !== undefined
            ? b.listingAgeDays
            : computeListingAge(resolveCurrentPublicationIso(b)).days;
        if (aAge === null && bAge === null) {
          cmp = b.finalScore - a.finalScore;
        } else if (aAge === null) {
          cmp = 1;
        } else if (bAge === null) {
          cmp = -1;
        } else {
          cmp = bAge - aAge || b.finalScore - a.finalScore;
        }
        break;
      }
      case "score_desc":
      default:
        cmp = b.finalScore - a.finalScore || a.totalMonthly - b.totalMonthly;
        break;
    }
    if (cmp !== 0) return cmp;
    return `${a.provider}:${a.id}`.localeCompare(`${b.provider}:${b.id}`);
  });

  return sorted;
}

export interface BenchmarkCityComparison {
  code: CityHubCode;
  label: string;
  cohortCount: number;
  totalEligible: number;
  medianMonthly: number | null;
  medianPm2: number | null;
  medianScore: number | null;
  upTo4200Count: number;
}

export function buildBenchmarkStats(evaluatedProperties: EvaluatedProperty[]) {
  const medianOf = (nums: number[], decimals = 0): number => {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const raw =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    const factor = 10 ** decimals;
    return Math.round(raw * factor) / factor;
  };

  const activeEligibleByCity = (code: CityHubCode, strictTop20 = false) =>
    evaluatedProperties.filter(
      (p) =>
        p.cityCode === code &&
        p.isActive !== false &&
        p.eligible &&
        (!strictTop20 || isStrictlyInTop20Neighborhoods(p)),
    );

  const bsbAllActive = evaluatedProperties.filter(
    (p) => p.cityCode === "BSB" && p.isActive !== false,
  );
  const bsbEligible = activeEligibleByCity("BSB", false);
  const bsbModernHigh = bsbEligible.filter(
    (p) =>
      p.modernityScore >= 72 &&
      p.parkingSpaces >= 1 &&
      p.areaM2 >= 48 &&
      p.areaM2 <= 75,
  );

  const countUpTo3400 = bsbEligible.filter(
    (p) => p.totalMonthly <= 3400,
  ).length;
  const countModernUpTo3400 = bsbModernHigh.filter(
    (p) => p.totalMonthly <= 3400,
  ).length;
  const countUpTo4000 = bsbEligible.filter(
    (p) => p.totalMonthly <= 4000,
  ).length;
  const countUpTo4500 = bsbEligible.filter(
    (p) => p.totalMonthly <= 4500,
  ).length;

  const bsbMedianMonthly = medianOf(bsbEligible.map((p) => p.totalMonthly));
  const bsbModernMedianMonthly = medianOf(
    (bsbModernHigh.length > 0 ? bsbModernHigh : bsbEligible).map(
      (p) => p.totalMonthly,
    ),
  );
  const bsbMedianPm2 = medianOf(
    bsbEligible.map((p) => p.totalMonthly / Math.max(1, p.areaM2)),
  );

  const cityComparisons: BenchmarkCityComparison[] = (
    [
      {
        code: "BSB" as const,
        label: "Águas Claras (Norte & Sul)",
        neighborhoods: [
          "águas claras",
          "sul (águas claras)",
          "norte (águas claras)",
          "águas claras norte",
          "águas claras sul",
        ],
      },
      {
        code: "CP" as const,
        label: "CP — Taquaral / Bosque / Guanabara",
        neighborhoods: [
          "taquaral",
          "bosque",
          "jd. guanabara",
          "nova campinas",
          "jd. chapadão",
        ],
      },
      {
        code: "BH" as const,
        label: "BH — Funcionários / Sion / S. Efigênia / Lourdes",
        neighborhoods: [
          "funcionários",
          "sion",
          "santo agostinho",
          "santa efigênia",
          "lourdes",
        ],
      },
      {
        code: "RJ" as const,
        label: "RJ — Zona Sul: Flamengo / Botafogo",
        neighborhoods: [
          "flamengo",
          "leme",
          "botafogo",
          "botafogo (orla)",
        ],
      },
      {
        code: "SP" as const,
        label: "SP — Moema / V. Mariana / Pinheiros",
        neighborhoods: [
          "moema",
          "vila mariana",
          "jardim paulista",
          "pinheiros",
        ],
      },
    ]
  ).map((spec) => {
    const allowedNbs = new Set(spec.neighborhoods);
    const items = evaluatedProperties.filter((p) => {
      if (p.cityCode !== spec.code || p.isActive === false) return false;
      if (!isStrictlyInTop20Neighborhoods(p)) return false;
      const tier = p.furnitureTier ?? classifyFurnitureTier(p);
      if (tier === "FULLY_FURNISHED") return false;
      if (p.areaM2 < 45 || p.areaM2 > 72) return false;
      if (p.totalMonthly > 5500) return false;
      if (p.totalMonthly / Math.max(1, p.areaM2) < 42) return false;
      const normNb = normalizeNeighborhoodKey(
        p.neighborhood ?? "",
        spec.code,
      ).toLowerCase();
      return allowedNbs.has(normNb);
    });

    const cohortCount = items.length;
    const isEmpty = cohortCount === 0;

    const byNb = new Map<string, EvaluatedProperty[]>();
    for (const p of items) {
      const k = normalizeNeighborhoodKey(
        p.neighborhood ?? "",
        spec.code,
      ).toLowerCase();
      const prev = byNb.get(k);
      if (prev) {
        prev.push(p);
      } else {
        byNb.set(k, [p]);
      }
    }

    const nbMonthlies: number[] = [];
    const nbPm2s: number[] = [];
    const nbScores: number[] = [];
    for (const [, list] of byNb.entries()) {
      const qaList = list.filter((p) => p.provider === "quintoandar");
      const nonQaList = list.filter((p) => p.provider !== "quintoandar");
      let rep = list;
      if (qaList.length >= 9 && nonQaList.length >= 9) {
        const qaMed = medianOf(qaList.map((p) => p.totalMonthly), 0);
        const nonQaMed = medianOf(nonQaList.map((p) => p.totalMonthly), 0);
        if (nonQaMed < qaMed * 0.89) {
          rep = qaList;
        }
      }
      nbMonthlies.push(medianOf(rep.map((p) => p.totalMonthly), 0));
      nbPm2s.push(
        medianOf(
          rep.map((p) => Math.round(p.totalMonthly / Math.max(1, p.areaM2))),
          0,
        ),
      );
      nbScores.push(medianOf(rep.map((p) => p.finalScore), 1));
    }

    const medianMonthly = isEmpty ? null : medianOf(nbMonthlies, 0);
    const medianPm2 = isEmpty ? null : medianOf(nbPm2s, 0);
    const medianScore = isEmpty ? null : medianOf(nbScores, 1);

    return {
      code: spec.code,
      label: spec.label,
      cohortCount,
      totalEligible: cohortCount,
      medianMonthly,
      medianPm2,
      medianScore,
      upTo4200Count: items.filter((p) => p.totalMonthly <= 4200).length,
    };
  });

  return {
    totalScrapedBsb: bsbAllActive.length,
    totalEligibleBsb: bsbEligible.length,
    countUpTo3400,
    countModernUpTo3400,
    countUpTo4000,
    countUpTo4500,
    bsbMedianMonthly,
    bsbModernMedianMonthly,
    bsbMedianPm2,
    contractGapReais: Math.max(0, bsbModernMedianMonthly - 3400),
    contractGapPct:
      bsbModernMedianMonthly > 0
        ? Math.round(((bsbModernMedianMonthly - 3400) / 3400) * 100)
        : 0,
    cityComparisons,
  };
}

export function formatTopPropertiesForAiPrompt(
  properties: EvaluatedProperty[],
  options?: {
    activeFilterLabels?: string[];
    favoriteKeys?: Set<string> | Iterable<string>;
    limit?: number;
  },
): string {
  const maxLimit = options?.limit ?? 50;
  const items = properties.slice(0, maxLimit);
  const totalFiltered = properties.length;
  const favSet = new Set<string>(options?.favoriteKeys ?? []);
  const filterLabels = options?.activeFilterLabels ?? [];

  const headerLines = [
    `# Top ${items.length} Imóveis Selecionados — Housing (BH · CP · RJ · SP)`,
    "",
    "**Contexto & Perfil do Morador**: Mudança de Brasília levando mobília e eletrodomésticos próprios (~6–8 m³: cama, sofá, geladeira, máquina de lavar, etc.), buscando apartamento sem mobília (ou no máximo semi-mobiliado sem conflito). Orçamento mensal total (Aluguel + Condomínio + IPTU) ideal ≤ R$ 5.500/mês e teto de R$ 6.500/mês; área útil ideal 48–68 m² (janela aceitável 40–95 m²); mínimo de 1 vaga de garagem livre e prédio com elevador; forte preferência por andar alto ou cobertura, prédio novo/reformado, segurança real ao caminhar na calçada e deslocamento rápido até o escritório do Nubank.",
    "",
    `- **Filtros ativos**: ${filterLabels.length > 0 ? filterLabels.join(" · ") : "Nenhum (busca padrão)"}`,
    `- **Total filtrado**: Exibindo top ${items.length} de ${totalFiltered} imóveis`,
    "",
    "---",
  ];

  if (items.length === 0) {
    return [...headerLines, "", "_Nenhum imóvel encontrado para os filtros atuais._"].join("\n");
  }

  const itemBlocks = items.map((p, idx) => {
    const propKey = `${p.provider}:${p.id}`;
    const isFav = favSet.has(propKey) || favSet.has(p.id);
    const allTags = [
      ...(p.cardTags.floorTag ? [p.cardTags.floorTag.label] : []),
      ...p.cardTags.greenTags,
      ...p.cardTags.warningTags,
      ...p.cardTags.redTags,
    ];
    const furnitureLabel =
      p.furnitureTier === "FULLY_FURNISHED"
        ? "Mobiliado"
        : p.furnitureTier === "SEMI_FURNISHED"
          ? "Semi-mobiliado (eletros)"
          : "Sem mobília";

    const rawDesc = (p.description ?? p.generatedDescription ?? "").trim();
    const cleanDesc =
      rawDesc && !/^\$\d+$/.test(rawDesc)
        ? rawDesc.replace(/\s+/g, " ").slice(0, 350) +
          (rawDesc.replace(/\s+/g, " ").length > 350 ? "…" : "")
        : null;

    const lines = [
      `### ${idx + 1}. [#${p.overallRank ?? "—"} Geral | #${p.cityRank ?? "—"} ${p.cityCode}] ${p.neighborhood} (${p.city}) — ${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ""}${p.condominiumName ? ` (${p.condominiumName})` : ""}${isFav ? " [★ FAVORITO]" : ""}`,
      `- **Score & Custos**: Nota: ${p.finalScore.toFixed(1)} pts | Pacote Total: R$ ${p.totalMonthly.toLocaleString("pt-BR")}/mês (Aluguel R$ ${p.rent.toLocaleString("pt-BR")} + Cond. R$ ${p.condoFee.toLocaleString("pt-BR")} + IPTU R$ ${p.iptu.toLocaleString("pt-BR")})`,
      `- **Planta & Andar**: ${p.areaM2} m² | ${p.bedrooms} quarto(s)${p.suites > 0 ? ` (${p.suites} suíte)` : ""} | ${p.bathrooms} banheiro(s) | ${p.parkingSpaces} vaga(s) | Andar: ${p.cardTags.floorTag?.label ?? "Não informado"} | Mobília: ${furnitureLabel} | Conservação: ${p.modernityTier} (${p.modernityScore}/100)${p.constructionYear ? ` · Ano ${p.constructionYear}` : ""}`,
      `- **Logística Nubank & Tags**: Tempo até o Nubank: ${p.commuteLabel ?? "~20-30 min"} | Tags: ${allTags.join(", ") || "Nenhuma"}`,
      `- **Prós & Ressalvas**: Resumo: ${p.shortJustification.replace(/\n+/g, " | ")}`,
    ];

    if (cleanDesc) {
      lines.push(`- **Descrição**: ${cleanDesc}`);
    }
    lines.push(`- **Link**: ${p.url} (${propKey})`);

    return lines.join("\n");
  });

  return [...headerLines, "", itemBlocks.join("\n\n")].join("\n");
}

export interface ParsedExplorerFiltersState {
  selectedCities: CityHubCode[];
  selectedNeighborhoods: string[];
  searchQuery: string;
  floorFilter: FloorFilterOption;
  floorFilters: FloorFilterOption[];
  minTotalMonthly: number | null;
  maxTotalMonthly: number | null;
  maxCommuteMinutes: number | null;
  minScore: number | null;
  sortBy: SortByOption;
  minAreaM2: number | null;
  maxAreaM2: number | null;
  minListingAgeDays: number | null;
  maxListingAgeDays: number | null;
  listingDateFrom: string;
  listingDateTo: string;
  selectedBedrooms: number[];
  selectedBathrooms: number[];
  selectedParking: number[];
  minBedrooms: number | null;
  minBathrooms: number | null;
  minParking: number | null;
  modernityTiers: ModernityTier[];
  minModernityScore: number | null;
  furnishedFilter: FurnishedFilterOption;
  selectedFurnitureTiers: FurnitureTier[];
  requiredFeatures: PropertyFeatureKey[];
  hideMegaCondo: boolean;
  hideForSale: boolean;
  onlyNewEntries: boolean;
  showIneligible: boolean;
  onlyIneligible: boolean;
  providerFilter: ProviderFilterOption;
  onlyFavorites: boolean;
  onlyTop20Neighborhoods: boolean;
  onlySafeStreets: boolean;
  enableBsbBenchmark: boolean;
  deactivatedFilter: DeactivatedFilterOption;
  showAdvancedFilters: boolean;
  viewMode: "split" | "list" | "map";
}

export function deriveLegacyFurnishedFilter(
  tiers: FurnitureTier[],
): FurnishedFilterOption {
  if (tiers.length === 0 || tiers.length >= 3) return "ALL";
  const set = new Set(tiers);
  if (set.size === 1) {
    if (set.has("UNFURNISHED")) return "UNFURNISHED";
    if (set.has("SEMI_FURNISHED")) return "SEMI_FURNISHED";
    if (set.has("FULLY_FURNISHED")) return "FURNISHED";
  }
  if (
    set.size === 2 &&
    set.has("UNFURNISHED") &&
    set.has("SEMI_FURNISHED")
  ) {
    return "UNFURNISHED_OR_SEMI";
  }
  if (
    set.size === 2 &&
    set.has("SEMI_FURNISHED") &&
    set.has("FULLY_FURNISHED")
  ) {
    return "FURNISHED";
  }
  return "ALL";
}

export function deriveFurnitureTiersFromLegacyFilter(
  furnishedFilter: FurnishedFilterOption | undefined,
): FurnitureTier[] {
  switch (furnishedFilter) {
    case "UNFURNISHED":
      return ["UNFURNISHED"];
    case "UNFURNISHED_OR_SEMI":
      return ["UNFURNISHED", "SEMI_FURNISHED"];
    case "SEMI_FURNISHED":
      return ["SEMI_FURNISHED"];
    case "FURNISHED":
      return ["SEMI_FURNISHED", "FULLY_FURNISHED"];
    default:
      return [];
  }
}

export function parseExplorerFiltersObject(
  raw: Record<string, unknown> | null | undefined,
): ParsedExplorerFiltersState {
  const parsed = (raw ?? {}) as Partial<
    PropertyExplorerFilters & {
      showAdvancedFilters?: boolean;
      viewMode?: "split" | "list" | "map";
    }
  >;

  const enableBsbBenchmark =
    typeof parsed.enableBsbBenchmark === "boolean"
      ? parsed.enableBsbBenchmark
      : false;

  let selectedCities: CityHubCode[] = [];
  if (Array.isArray(parsed.selectedCities)) {
    const validCities = parsed.selectedCities.filter(
      (c): c is CityHubCode =>
        c === "BH" ||
        c === "CP" ||
        c === "RJ" ||
        c === "SP" ||
        (enableBsbBenchmark && c === "BSB"),
    );
    const uniqueCities = [...new Set(validCities)];
    selectedCities =
      !enableBsbBenchmark && uniqueCities.length >= 4 ? [] : uniqueCities;
  } else if (
    parsed.selectedCity === "BH" ||
    parsed.selectedCity === "CP" ||
    parsed.selectedCity === "RJ" ||
    parsed.selectedCity === "SP" ||
    (enableBsbBenchmark && parsed.selectedCity === "BSB")
  ) {
    selectedCities = [parsed.selectedCity];
  }

  let floorFilters: FloorFilterOption[] = [];
  if (Array.isArray(parsed.floorFilters)) {
    const validFloors = parsed.floorFilters.filter(
      (f): f is FloorFilterOption =>
        typeof f === "string" &&
        f !== "ALL" &&
        FLOOR_FILTER_OPTIONS.some((o) => o.value === f),
    );
    floorFilters = [...new Set(validFloors)];
  } else if (
    typeof parsed.floorFilter === "string" &&
    parsed.floorFilter !== "ALL" &&
    FLOOR_FILTER_OPTIONS.some((o) => o.value === parsed.floorFilter)
  ) {
    floorFilters = [parsed.floorFilter as FloorFilterOption];
  }

  const selectedBedrooms = Array.isArray(parsed.selectedBedrooms)
    ? [
        ...new Set(
          parsed.selectedBedrooms.filter(
            (n): n is number =>
              typeof n === "number" && (n === 1 || n === 2 || n === 3),
          ),
        ),
      ].sort((a, b) => a - b)
    : [];

  const selectedBathrooms = Array.isArray(parsed.selectedBathrooms)
    ? [
        ...new Set(
          parsed.selectedBathrooms.filter(
            (n): n is number =>
              typeof n === "number" && (n === 1 || n === 2 || n === 3),
          ),
        ),
      ].sort((a, b) => a - b)
    : [];

  const selectedParking = Array.isArray(parsed.selectedParking)
    ? [
        ...new Set(
          parsed.selectedParking.filter(
            (n): n is number => typeof n === "number" && (n === 1 || n === 2),
          ),
        ),
      ].sort((a, b) => a - b)
    : [];

  const validLegacyFurnishedFilter: FurnishedFilterOption =
    parsed.furnishedFilter === "ALL" ||
    parsed.furnishedFilter === "UNFURNISHED" ||
    parsed.furnishedFilter === "UNFURNISHED_OR_SEMI" ||
    parsed.furnishedFilter === "SEMI_FURNISHED" ||
    parsed.furnishedFilter === "FURNISHED"
      ? parsed.furnishedFilter
      : "ALL";

  let selectedFurnitureTiers: FurnitureTier[] = [];
  if (Array.isArray(parsed.selectedFurnitureTiers)) {
    const validTiers = parsed.selectedFurnitureTiers.filter(
      (t): t is FurnitureTier =>
        t === "UNFURNISHED" ||
        t === "SEMI_FURNISHED" ||
        t === "FULLY_FURNISHED",
    );
    const uniqueTiers = [...new Set(validTiers)];
    selectedFurnitureTiers = uniqueTiers.length >= 3 ? [] : uniqueTiers;
  } else if (validLegacyFurnishedFilter !== "ALL") {
    selectedFurnitureTiers = deriveFurnitureTiersFromLegacyFilter(
      validLegacyFurnishedFilter,
    );
  }

  const furnishedFilter: FurnishedFilterOption = Array.isArray(
    parsed.selectedFurnitureTiers,
  )
    ? deriveLegacyFurnishedFilter(selectedFurnitureTiers)
    : validLegacyFurnishedFilter;

  return {
    selectedCities,
    selectedNeighborhoods: Array.isArray(parsed.selectedNeighborhoods)
      ? parsed.selectedNeighborhoods.filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
    floorFilter: floorFilters.length > 0 ? floorFilters[0]! : "ALL",
    floorFilters,
    minTotalMonthly:
      typeof parsed.minTotalMonthly === "number" ? parsed.minTotalMonthly : null,
    maxTotalMonthly:
      "maxTotalMonthly" in parsed
        ? typeof parsed.maxTotalMonthly === "number"
          ? parsed.maxTotalMonthly
          : null
        : 5000,
    maxCommuteMinutes:
      typeof parsed.maxCommuteMinutes === "number"
        ? parsed.maxCommuteMinutes
        : null,
    minScore: typeof parsed.minScore === "number" ? parsed.minScore : null,
    sortBy:
      typeof parsed.sortBy === "string" &&
      SORT_BY_OPTIONS.some((o) => o.value === parsed.sortBy)
        ? (parsed.sortBy as SortByOption)
        : "score_desc",
    minAreaM2: typeof parsed.minAreaM2 === "number" ? parsed.minAreaM2 : null,
    maxAreaM2: typeof parsed.maxAreaM2 === "number" ? parsed.maxAreaM2 : null,
    minListingAgeDays:
      typeof parsed.minListingAgeDays === "number" &&
      Number.isFinite(parsed.minListingAgeDays)
        ? parsed.minListingAgeDays
        : null,
    maxListingAgeDays:
      typeof parsed.maxListingAgeDays === "number" &&
      Number.isFinite(parsed.maxListingAgeDays)
        ? parsed.maxListingAgeDays
        : null,
    listingDateFrom:
      typeof parsed.listingDateFrom === "string" ? parsed.listingDateFrom : "",
    listingDateTo:
      typeof parsed.listingDateTo === "string" ? parsed.listingDateTo : "",
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms:
      typeof parsed.minBedrooms === "number" ? parsed.minBedrooms : null,
    minBathrooms:
      typeof parsed.minBathrooms === "number" ? parsed.minBathrooms : null,
    minParking: typeof parsed.minParking === "number" ? parsed.minParking : null,
    modernityTiers: Array.isArray(parsed.modernityTiers)
      ? parsed.modernityTiers.filter(
          (t): t is ModernityTier =>
            t === "MODERN_OR_RENOVATED" ||
            t === "WELL_MAINTAINED" ||
            t === "STANDARD" ||
            t === "DATED",
        )
      : [],
    minModernityScore:
      typeof parsed.minModernityScore === "number"
        ? parsed.minModernityScore
        : null,
    furnishedFilter,
    selectedFurnitureTiers,
    requiredFeatures: Array.isArray(parsed.requiredFeatures)
      ? parsed.requiredFeatures.filter((f): f is PropertyFeatureKey =>
          PROPERTY_FEATURE_OPTIONS.some((opt) => opt.key === f),
        )
      : [],
    hideMegaCondo:
      typeof parsed.hideMegaCondo === "boolean" ? parsed.hideMegaCondo : false,
    hideForSale:
      typeof parsed.hideForSale === "boolean" ? parsed.hideForSale : false,
    onlyNewEntries:
      typeof parsed.onlyNewEntries === "boolean" ? parsed.onlyNewEntries : false,
    showIneligible:
      typeof parsed.showIneligible === "boolean" ? parsed.showIneligible : false,
    onlyIneligible:
      typeof parsed.onlyIneligible === "boolean" ? parsed.onlyIneligible : false,
    providerFilter:
      parsed.providerFilter === "ALL" ||
      parsed.providerFilter === "quintoandar" ||
      parsed.providerFilter === "zapimoveis" ||
      parsed.providerFilter === "vivareal" ||
      parsed.providerFilter === "netimoveis" ||
      parsed.providerFilter === "imovelweb"
        ? parsed.providerFilter
        : "ALL",
    onlyFavorites:
      typeof parsed.onlyFavorites === "boolean" ? parsed.onlyFavorites : false,
    onlyTop20Neighborhoods:
      typeof parsed.onlyTop20Neighborhoods === "boolean"
        ? parsed.onlyTop20Neighborhoods
        : false,
    onlySafeStreets:
      typeof parsed.onlySafeStreets === "boolean"
        ? parsed.onlySafeStreets
        : false,
    enableBsbBenchmark,
    deactivatedFilter:
      parsed.deactivatedFilter === "ACTIVE_ONLY" ||
      parsed.deactivatedFilter === "ALL" ||
      parsed.deactivatedFilter === "DEACTIVATED_ONLY"
        ? parsed.deactivatedFilter
        : "ACTIVE_ONLY",
    showAdvancedFilters:
      typeof parsed.showAdvancedFilters === "boolean"
        ? parsed.showAdvancedFilters
        : false,
    viewMode:
      parsed.viewMode === "split" ||
      parsed.viewMode === "list" ||
      parsed.viewMode === "map"
        ? parsed.viewMode
        : "list",
  };
}

export function serializeExplorerFilters(state: ParsedExplorerFiltersState) {
  return {
    selectedCities: state.selectedCities,
    selectedCity:
      state.selectedCities.length === 1 ? state.selectedCities[0]! : "ALL",
    selectedNeighborhoods: state.selectedNeighborhoods,
    searchQuery: state.searchQuery,
    floorFilter:
      state.floorFilters.length === 1 ? state.floorFilters[0]! : "ALL",
    floorFilters: state.floorFilters,
    minTotalMonthly: state.minTotalMonthly,
    maxTotalMonthly: state.maxTotalMonthly,
    maxCommuteMinutes: state.maxCommuteMinutes,
    minScore: state.minScore,
    sortBy: state.sortBy,
    minAreaM2: state.minAreaM2,
    maxAreaM2: state.maxAreaM2,
    minListingAgeDays: state.minListingAgeDays,
    maxListingAgeDays: state.maxListingAgeDays,
    listingDateFrom: state.listingDateFrom,
    listingDateTo: state.listingDateTo,
    selectedBedrooms: state.selectedBedrooms,
    selectedBathrooms: state.selectedBathrooms,
    selectedParking: state.selectedParking,
    minBedrooms: state.minBedrooms,
    minBathrooms: state.minBathrooms,
    minParking: state.minParking,
    modernityTiers: state.modernityTiers,
    minModernityScore: state.minModernityScore,
    furnishedFilter: state.furnishedFilter,
    selectedFurnitureTiers: state.selectedFurnitureTiers,
    requiredFeatures: state.requiredFeatures,
    hideMegaCondo: state.hideMegaCondo,
    hideForSale: state.hideForSale,
    onlyNewEntries: state.onlyNewEntries,
    showIneligible: state.showIneligible,
    onlyIneligible: state.onlyIneligible,
    providerFilter: state.providerFilter,
    onlyFavorites: state.onlyFavorites,
    onlyTop20Neighborhoods: state.onlyTop20Neighborhoods,
    onlySafeStreets: state.onlySafeStreets,
    enableBsbBenchmark: state.enableBsbBenchmark,
    deactivatedFilter: state.deactivatedFilter,
    showAdvancedFilters: state.showAdvancedFilters,
    viewMode: state.viewMode,
  };
}
