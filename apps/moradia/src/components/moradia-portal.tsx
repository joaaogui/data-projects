"use client";

import { PropertyChatDrawer } from "@/components/property-chat-drawer";
import { PropertyMapView } from "@/components/property-map-view";
import {
  getCardPhotoUrl,
  handleImgError,
  PropertyCardPhotoShowcase,
  PropertyPhotoGalleryModal,
} from "@/components/property-photo-showcase";
import {
  BUILTIN_PRESETS,
  categorizePropertyFeatures,
  classifyFurnitureTier,
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
  normalizeNeighborhoodKey,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  EvaluatedProperty,
  FloorRarity,
  ModernityTier,
  MoradiaDatasetPayload,
  PropertyQuestionItem,
  ScoringWeights,
  ScrapeJobStatus,
  SharedUserPreferences,
} from "@/types/moradia";
import { ThemeToggle } from "@data-projects/ui";
import {
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Filter,
  GitCompare,
  Heart,
  Images,
  Columns2,
  List,
  Link2,
  Loader2,
  Map as MapIcon,
  MapPin,
  MessageSquarePlus,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  | "commute_asc";

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
  | "pets";

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
  selectedBedrooms?: number[];
  selectedBathrooms?: number[];
  selectedParking?: number[];
  minBedrooms?: number | null;
  minBathrooms?: number | null;
  minParking?: number | null;
  modernityTiers: ModernityTier[];
  minModernityScore: number | null;
  furnishedFilter: FurnishedFilterOption;
  requiredFeatures: PropertyFeatureKey[];
  hideMegaCondo: boolean;
  hideForSale: boolean;
  onlyNewEntries: boolean;
  showIneligible: boolean;
  providerFilter: ProviderFilterOption;
  onlyFavorites: boolean;
  onlyTop20Neighborhoods?: boolean;
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
  selectedBedrooms: [],
  selectedBathrooms: [],
  selectedParking: [],
  minBedrooms: null,
  minBathrooms: null,
  minParking: null,
  modernityTiers: [],
  minModernityScore: null,
  furnishedFilter: "ALL",
  requiredFeatures: [],
  hideMegaCondo: false,
  hideForSale: false,
  onlyNewEntries: false,
  showIneligible: false,
  providerFilter: "ALL",
  onlyFavorites: false,
  onlyTop20Neighborhoods: false,
  enableBsbBenchmark: false,
  deactivatedFilter: "ACTIVE_ONLY",
  favoriteKeys: [],
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
];

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

export function matchesPropertyFeature(
  prop: EvaluatedProperty,
  feature: PropertyFeatureKey,
): boolean {
  const fullText = [
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
        /\b(varanda|sacada|balcony)\b/i.test(fullText)
      );
    case "suite":
      return prop.suites >= 1 || /\bsu[ií]tes?\b/i.test(fullText);
    case "doorman_24h":
      return (
        prop.nuanceHighlights.includes("Portaria 24h / Biometria") ||
        prop.doorman === "NightAndDayShift" ||
        prop.doorman === "24h" ||
        /\b(portaria_24h|concierge_24h|portaria 24|porteiro 24|portaria virtual|biometria)\b/i.test(
          fullText,
        )
      );
    case "pool_gym":
      return /\b(piscina|academia|fitness|gym|pool)\b/i.test(fullText);
    case "pets":
      return prop.acceptsPets === true;
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
    "funcionários",
    "funcionarios",
    "lourdes",
    "santa efigênia",
    "santa efigenia",
    "santo agostinho",
    "sion",
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
    "tijuca",
    "tijuca (pç uruguai)",
    "jd. oceânico",
    "jd. oceanico",
    "jardim oceânico",
    "jardim oceanico",
    "barra da tijuca",
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

export function filterAndSortProperties(
  properties: EvaluatedProperty[],
  filters: PropertyExplorerFilters,
  favoriteKeysArg?: Iterable<string>,
): EvaluatedProperty[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const favSet = new Set<string>([
    ...(filters.favoriteKeys ?? []),
    ...(favoriteKeysArg ?? []),
  ]);
  const onlyFavorites = filters.onlyFavorites ?? false;
  const enableBsbBenchmark = filters.enableBsbBenchmark ?? false;
  const deactivatedFilter: DeactivatedFilterOption =
    filters.deactivatedFilter ?? "ACTIVE_ONLY";

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
    if (
      filters.selectedNeighborhoods.length > 0 &&
      !filters.selectedNeighborhoods.some(
        (sel) =>
          sel === p.neighborhood ||
          normalizeNeighborhoodKey(sel, p.cityCode) ===
            normalizeNeighborhoodKey(p.neighborhood, p.cityCode),
      )
    ) {
      return false;
    }
    if (!filters.showIneligible && !onlyFavorites && !p.eligible) {
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
      (p.commuteMinutes ?? 25) > filters.maxCommuteMinutes
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
    const furnitureTier = p.furnitureTier ?? classifyFurnitureTier(p);
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
    if (filters.providerFilter !== "ALL") {
      if (filters.providerFilter === "zapimoveis") {
        if (p.provider !== "zapimoveis" && p.provider !== "zap") {
          return false;
        }
      } else if (p.provider !== filters.providerFilter) {
        return false;
      }
    }
    if (filters.onlyNewEntries && !p.isNewEntry) {
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
      const fullDesc = `${p.title ?? ""} ${p.description ?? ""} ${p.generatedDescription ?? ""}`;
      const isForSale =
        (p.salePrice ?? 0) > 0 ||
        /\b(est[aá] [aà] venda|dispon[ií]vel para venda|visita de poss[ií]veis interessados)\b/i.test(
          fullDesc,
        );
      if (isForSale) return false;
    }
    if (filters.requiredFeatures.length > 0) {
      for (const feat of filters.requiredFeatures) {
        if (!matchesPropertyFeature(p, feat)) {
          return false;
        }
      }
    }
    if (q) {
      const hay = [
        p.neighborhood,
        p.street,
        p.condominiumName ?? "",
        p.title,
        p.description ?? "",
        p.generatedDescription ?? "",
        ...p.positiveSignals,
        ...p.nuanceHighlights,
        ...p.installations,
        ...p.amenities,
        ...p.comfortCommodities,
        ...p.practicalityCommodities,
        ...p.placesNearby.map((pl) => pl.name),
        p.id,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    switch (filters.sortBy) {
      case "score_asc":
        return a.finalScore - b.finalScore || a.totalMonthly - b.totalMonthly;
      case "price_asc":
        return a.totalMonthly - b.totalMonthly || b.finalScore - a.finalScore;
      case "price_desc":
        return b.totalMonthly - a.totalMonthly || b.finalScore - a.finalScore;
      case "rent_asc":
        return a.rent - b.rent || b.finalScore - a.finalScore;
      case "rent_desc":
        return b.rent - a.rent || b.finalScore - a.finalScore;
      case "area_desc":
        return b.areaM2 - a.areaM2 || b.finalScore - a.finalScore;
      case "modernity_desc":
        return (
          b.modernityScore - a.modernityScore || b.finalScore - a.finalScore
        );
      case "price_per_m2_asc": {
        const aPm2 = a.totalMonthly / Math.max(1, a.areaM2);
        const bPm2 = b.totalMonthly / Math.max(1, b.areaM2);
        return aPm2 - bPm2 || b.finalScore - a.finalScore;
      }
      case "floor_desc": {
        const aFl = getEffectiveFloorSortValue(a);
        const bFl = getEffectiveFloorSortValue(b);
        return bFl - aFl || b.finalScore - a.finalScore;
      }
      case "commute_asc":
        return (
          (a.commuteMinutes ?? 99) - (b.commuteMinutes ?? 99) ||
          b.finalScore - a.finalScore
        );
      case "score_desc":
      default:
        return b.finalScore - a.finalScore || a.totalMonthly - b.totalMonthly;
    }
  });

  return sorted;
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

const CITY_LABELS: Record<CityHubCode | "ALL", string> = {
  ALL: "Todas as 4 Praças",
  BH: "Belo Horizonte (MG)",
  CP: "Campinas (SP)",
  RJ: "Rio de Janeiro (RJ)",
  SP: "São Paulo Capital (SP)",
  BSB: "Águas Claras — Brasília (DF) [Benchmark]",
};

const CITY_BADGE_INFO: Record<
  CityHubCode,
  { ufLabel: string; className: string }
> = {
  BH: {
    ufLabel: "BH",
    className:
      "border-teal-500/30 bg-teal-500/10 text-teal-800 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-200",
  },
  CP: {
    ufLabel: "CP",
    className:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200",
  },
  RJ: {
    ufLabel: "RJ",
    className:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200",
  },
  SP: {
    ufLabel: "SP",
    className:
      "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-800 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/10 dark:text-fuchsia-200",
  },
  BSB: {
    ufLabel: "BSB · Ref",
    className:
      "border-amber-500/45 bg-amber-500/15 text-amber-800 dark:border-amber-400/45 dark:bg-amber-400/15 dark:text-amber-200",
  },
};

const MODERNITY_TIER_BADGES: Record<
  string,
  { label: string; shortLabel: string; dotClassName: string; className: string }
> = {
  MODERN_OR_RENOVATED: {
    label: "Estado: Novo / Reformado",
    shortLabel: "Novo / Reformado",
    dotClassName: "text-emerald-600 dark:text-emerald-400",
    className:
      "bg-stone-100/90 text-stone-800 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700",
  },
  WELL_MAINTAINED: {
    label: "Estado: Bem Conservado",
    shortLabel: "Bem Conservado",
    dotClassName: "text-teal-600 dark:text-teal-400",
    className:
      "bg-stone-100/90 text-stone-800 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700",
  },
  STANDARD: {
    label: "Estado: Padrão",
    shortLabel: "Padrão",
    dotClassName: "text-amber-600 dark:text-amber-400",
    className:
      "bg-stone-100/90 text-stone-700 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
  },
  DATED: {
    label: "Estado: Antigo / Datado",
    shortLabel: "Antigo / Datado",
    dotClassName: "text-rose-600 dark:text-rose-400",
    className:
      "bg-stone-100/90 text-stone-700 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
  },
};

const PROVIDER_BUTTON_STYLES: Record<
  string,
  { label: string; cardClassName: string }
> = {
  quintoandar: {
    label: "QuintoAndar",
    cardClassName:
      "border-indigo-600/30 bg-indigo-500/10 text-indigo-800 hover:bg-indigo-500/20 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25",
  },
  zapimoveis: {
    label: "Zap Imóveis",
    cardClassName:
      "border-orange-600/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/20 dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-200 dark:hover:bg-orange-500/25",
  },
  zap: {
    label: "Zap Imóveis",
    cardClassName:
      "border-orange-600/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/20 dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-200 dark:hover:bg-orange-500/25",
  },
  vivareal: {
    label: "Viva Real",
    cardClassName:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25",
  },
  imovelweb: {
    label: "Imovelweb",
    cardClassName:
      "border-amber-600/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25",
  },
  netimoveis: {
    label: "Netimóveis",
    cardClassName:
      "border-sky-600/30 bg-sky-500/10 text-sky-900 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25",
  },
};

function getProviderStyle(provider: string | undefined) {
  return (
    (provider ? PROVIDER_BUTTON_STYLES[provider] : undefined) ??
    PROVIDER_BUTTON_STYLES.zapimoveis!
  );
}

const FLOOR_RARITY_BADGES: Record<FloorRarity, { className: string }> = {
  legendary: {
    className:
      "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300",
  },
  epic: {
    className:
      "border-purple-500/50 bg-purple-500/15 text-purple-700 dark:border-purple-400/50 dark:bg-purple-500/20 dark:text-purple-300",
  },
  rare: {
    className:
      "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/20 dark:text-sky-300",
  },
  uncommon: {
    className:
      "border-zinc-400/50 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/50 dark:bg-zinc-500/20 dark:text-zinc-300",
  },
  common: {
    className:
      "border-rose-600/50 bg-rose-500/18 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/22 dark:text-rose-200",
  },
};

const DEFAULT_COMPARE_KEYS = [
  "quintoandar:893127481",
  "zapimoveis:2900134401",
  "quintoandar:895394820",
];

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
  selectedBedrooms: number[];
  selectedBathrooms: number[];
  selectedParking: number[];
  minBedrooms: number | null;
  minBathrooms: number | null;
  minParking: number | null;
  modernityTiers: ModernityTier[];
  minModernityScore: number | null;
  furnishedFilter: FurnishedFilterOption;
  requiredFeatures: PropertyFeatureKey[];
  hideMegaCondo: boolean;
  hideForSale: boolean;
  onlyNewEntries: boolean;
  showIneligible: boolean;
  providerFilter: ProviderFilterOption;
  onlyFavorites: boolean;
  onlyTop20Neighborhoods: boolean;
  enableBsbBenchmark: boolean;
  deactivatedFilter: DeactivatedFilterOption;
  showAdvancedFilters: boolean;
  viewMode: "split" | "list" | "map";
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
      typeof parsed.maxTotalMonthly === "number" ? parsed.maxTotalMonthly : null,
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
    furnishedFilter:
      parsed.furnishedFilter === "ALL" ||
      parsed.furnishedFilter === "UNFURNISHED" ||
      parsed.furnishedFilter === "UNFURNISHED_OR_SEMI" ||
      parsed.furnishedFilter === "SEMI_FURNISHED" ||
      parsed.furnishedFilter === "FURNISHED"
        ? parsed.furnishedFilter
        : "ALL",
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

function serializeExplorerFilters(state: ParsedExplorerFiltersState) {
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
    selectedBedrooms: state.selectedBedrooms,
    selectedBathrooms: state.selectedBathrooms,
    selectedParking: state.selectedParking,
    minBedrooms: state.minBedrooms,
    minBathrooms: state.minBathrooms,
    minParking: state.minParking,
    modernityTiers: state.modernityTiers,
    minModernityScore: state.minModernityScore,
    furnishedFilter: state.furnishedFilter,
    requiredFeatures: state.requiredFeatures,
    hideMegaCondo: state.hideMegaCondo,
    hideForSale: state.hideForSale,
    onlyNewEntries: state.onlyNewEntries,
    showIneligible: state.showIneligible,
    providerFilter: state.providerFilter,
    onlyFavorites: state.onlyFavorites,
    onlyTop20Neighborhoods: state.onlyTop20Neighborhoods,
    enableBsbBenchmark: state.enableBsbBenchmark,
    deactivatedFilter: state.deactivatedFilter,
    showAdvancedFilters: state.showAdvancedFilters,
    viewMode: state.viewMode,
  };
}

export function MoradiaPortal({
  initialDataset,
  initialPreferences,
}: {
  initialDataset: MoradiaDatasetPayload;
  initialPreferences?: SharedUserPreferences;
}) {
  const resolvedInitialPrefs = initialPreferences ?? initialDataset.preferences;
  const initialParsedFilters = useMemo(
    () => parseExplorerFiltersObject(resolvedInitialPrefs?.filters),
    [resolvedInitialPrefs],
  );
  const initialWeights = useMemo<ScoringWeights>(
    () => ({ ...DEFAULT_WEIGHTS, ...(resolvedInitialPrefs?.weights ?? {}) }),
    [resolvedInitialPrefs],
  );
  const initialPresetId =
    resolvedInitialPrefs?.activePresetId || "balanced-original";
  const initialFavorites = useMemo(
    () => resolvedInitialPrefs?.favorites ?? initialDataset.favorites ?? [],
    [resolvedInitialPrefs, initialDataset.favorites],
  );
  const initialCompareKeys = useMemo(
    () =>
      resolvedInitialPrefs?.compareKeys &&
      resolvedInitialPrefs.compareKeys.length > 0
        ? resolvedInitialPrefs.compareKeys
        : DEFAULT_COMPARE_KEYS,
    [resolvedInitialPrefs],
  );

  const [dataset, setDataset] = useState<MoradiaDatasetPayload>(initialDataset);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [weights, setWeights] = useState<ScoringWeights>(initialWeights);
  const [activePresetId, setActivePresetId] = useState<string>(initialPresetId);
  const [activeTab, setActiveTab] = useState<
    "properties" | "neighborhoods" | "compare"
  >("properties");
  const [selectedCities, setSelectedCities] = useState<CityHubCode[]>(
    initialParsedFilters.selectedCities,
  );
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(
    initialParsedFilters.selectedNeighborhoods,
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    initialParsedFilters.searchQuery,
  );
  const [floorFilters, setFloorFilters] = useState<FloorFilterOption[]>(
    initialParsedFilters.floorFilters,
  );
  const floorFilter: FloorFilterOption =
    floorFilters.length === 1 ? floorFilters[0]! : "ALL";
  const [minTotalMonthly, setMinTotalMonthly] = useState<number | null>(
    initialParsedFilters.minTotalMonthly,
  );
  const [maxTotalMonthly, setMaxTotalMonthly] = useState<number | null>(
    initialParsedFilters.maxTotalMonthly,
  );
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState<number | null>(
    initialParsedFilters.maxCommuteMinutes,
  );
  const [minScore, setMinScore] = useState<number | null>(
    initialParsedFilters.minScore,
  );
  const [sortBy, setSortBy] = useState<SortByOption>(
    initialParsedFilters.sortBy,
  );
  const [minAreaM2, setMinAreaM2] = useState<number | null>(
    initialParsedFilters.minAreaM2,
  );
  const [maxAreaM2, setMaxAreaM2] = useState<number | null>(
    initialParsedFilters.maxAreaM2,
  );
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>(
    initialParsedFilters.selectedBedrooms,
  );
  const [selectedBathrooms, setSelectedBathrooms] = useState<number[]>(
    initialParsedFilters.selectedBathrooms,
  );
  const [selectedParking, setSelectedParking] = useState<number[]>(
    initialParsedFilters.selectedParking,
  );
  const [minBedrooms, setMinBedrooms] = useState<number | null>(
    initialParsedFilters.minBedrooms,
  );
  const [minBathrooms, setMinBathrooms] = useState<number | null>(
    initialParsedFilters.minBathrooms,
  );
  const [minParking, setMinParking] = useState<number | null>(
    initialParsedFilters.minParking,
  );
  const [modernityTiers, setModernityTiers] = useState<ModernityTier[]>(
    initialParsedFilters.modernityTiers,
  );
  const [minModernityScore, setMinModernityScore] = useState<number | null>(
    initialParsedFilters.minModernityScore,
  );
  const [furnishedFilter, setFurnishedFilter] =
    useState<FurnishedFilterOption>(initialParsedFilters.furnishedFilter);
  const [requiredFeatures, setRequiredFeatures] = useState<
    PropertyFeatureKey[]
  >(initialParsedFilters.requiredFeatures);
  const [hideMegaCondo, setHideMegaCondo] = useState<boolean>(
    initialParsedFilters.hideMegaCondo,
  );
  const [hideForSale, setHideForSale] = useState<boolean>(
    initialParsedFilters.hideForSale,
  );
  const [onlyNewEntries, setOnlyNewEntries] = useState<boolean>(
    initialParsedFilters.onlyNewEntries,
  );
  const [showIneligible, setShowIneligible] = useState<boolean>(
    initialParsedFilters.showIneligible,
  );
  const [providerFilter, setProviderFilter] =
    useState<ProviderFilterOption>(initialParsedFilters.providerFilter);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(
    initialParsedFilters.onlyFavorites,
  );
  const [onlyTop20Neighborhoods, setOnlyTop20Neighborhoods] = useState<boolean>(
    initialParsedFilters.onlyTop20Neighborhoods,
  );
  const [enableBsbBenchmark, setEnableBsbBenchmark] = useState<boolean>(
    initialParsedFilters.enableBsbBenchmark,
  );
  const [benchmarkPanelCollapsed, setBenchmarkPanelCollapsed] =
    useState<boolean>(false);
  const [deactivatedFilter, setDeactivatedFilter] =
    useState<DeactivatedFilterOption>(initialParsedFilters.deactivatedFilter);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(initialFavorites);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(
    initialParsedFilters.showAdvancedFilters,
  );
  const [showSlidersDrawer, setShowSlidersDrawer] = useState<boolean>(false);
  const [showScrapeDrawer, setShowScrapeDrawer] = useState<boolean>(false);
  const [scrapeCities, setScrapeCities] = useState<CityHubCode[]>([
    "BH",
    "RJ",
    "CP",
    "SP",
  ]);
  const [customSearchUrl, setCustomSearchUrl] = useState<string>("");
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeJobStatus>({
    jobId: "none",
    status: "idle",
  });
  const [isStartingScrape, setIsStartingScrape] = useState<boolean>(false);
  const prevScrapeStatusRef = useRef<ScrapeJobStatus["status"]>("idle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [galleryState, setGalleryState] = useState<{
    property: EvaluatedProperty;
    initialIndex: number;
  } | null>(null);
  const [extraPhotosByKey, setExtraPhotosByKey] = useState<
    Record<string, Array<{ room: string | null; url: string }>>
  >({});
  const fetchedPhotoKeysRef = useRef<Set<string>>(new Set());
  const [compareKeys, setCompareKeys] = useState<string[]>(initialCompareKeys);
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">(
    initialParsedFilters.viewMode,
  );
  const [hoveredPropertyKey, setHoveredPropertyKey] = useState<string | null>(
    null,
  );
  const [selectedMapPropertyKey, setSelectedMapPropertyKey] = useState<
    string | null
  >(null);
  const [qaItems, setQaItems] = useState<PropertyQuestionItem[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [pinnedChatPropertyKey, setPinnedChatPropertyKey] = useState<
    string | null
  >(null);
  const [chatScrollTargetKey, setChatScrollTargetKey] = useState<string | null>(
    null,
  );
  const [isSubmittingChatQuestion, setIsSubmittingChatQuestion] =
    useState<boolean>(false);

  const focusCardInList = useCallback((key: string) => {
    setViewMode((prev) => (prev === "map" ? "split" : prev));
    setExpandedId(key);
    setSelectedMapPropertyKey(key);
    setTimeout(() => {
      const safeId = `property-card-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const el = document.getElementById(safeId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  }, []);
  const [filtersHydrated, setFiltersHydrated] = useState<boolean>(false);
  const lastSyncedUpdatedAtRef = useRef<string>(
    resolvedInitialPrefs?.updatedAt ?? "",
  );
  const lastSavedSnapshotJsonRef = useRef<string>(
    JSON.stringify({
      filters: serializeExplorerFilters(initialParsedFilters),
      weights: initialWeights,
      activePresetId: initialPresetId,
      favorites: initialFavorites,
      compareKeys: initialCompareKeys,
    }),
  );
  const isDirtyRef = useRef<boolean>(false);
  const isApplyingRemotePrefsRef = useRef<boolean>(false);

  const applyFilterStateObject = useCallback(
    (parsed: ParsedExplorerFiltersState) => {
      setSelectedCities(parsed.selectedCities);
      setSelectedNeighborhoods(parsed.selectedNeighborhoods);
      setSearchQuery(parsed.searchQuery);
      setFloorFilters(parsed.floorFilters);
      setMinTotalMonthly(parsed.minTotalMonthly);
      setMaxTotalMonthly(parsed.maxTotalMonthly);
      setMaxCommuteMinutes(parsed.maxCommuteMinutes);
      setMinScore(parsed.minScore);
      setSortBy(parsed.sortBy);
      setMinAreaM2(parsed.minAreaM2);
      setMaxAreaM2(parsed.maxAreaM2);
      setSelectedBedrooms(parsed.selectedBedrooms);
      setSelectedBathrooms(parsed.selectedBathrooms);
      setSelectedParking(parsed.selectedParking);
      setMinBedrooms(parsed.minBedrooms);
      setMinBathrooms(parsed.minBathrooms);
      setMinParking(parsed.minParking);
      setModernityTiers(parsed.modernityTiers);
      setMinModernityScore(parsed.minModernityScore);
      setFurnishedFilter(parsed.furnishedFilter);
      setRequiredFeatures(parsed.requiredFeatures);
      setHideMegaCondo(parsed.hideMegaCondo);
      setHideForSale(parsed.hideForSale);
      setOnlyNewEntries(parsed.onlyNewEntries);
      setShowIneligible(parsed.showIneligible);
      setProviderFilter(parsed.providerFilter);
      setOnlyFavorites(parsed.onlyFavorites);
      setOnlyTop20Neighborhoods(parsed.onlyTop20Neighborhoods);
      setEnableBsbBenchmark(parsed.enableBsbBenchmark);
      setDeactivatedFilter(parsed.deactivatedFilter);
      setShowAdvancedFilters(parsed.showAdvancedFilters);
      setViewMode(parsed.viewMode);
    },
    [],
  );

  const applySharedPreferencesToState = useCallback(
    (prefs: SharedUserPreferences) => {
      const parsedFilters = parseExplorerFiltersObject(prefs.filters);
      const nextWeights: ScoringWeights = {
        ...DEFAULT_WEIGHTS,
        ...(prefs.weights ?? {}),
      };
      const nextPresetId = prefs.activePresetId || "balanced-original";
      const nextFavorites = Array.isArray(prefs.favorites)
        ? prefs.favorites
        : [];
      const nextCompareKeys =
        Array.isArray(prefs.compareKeys) && prefs.compareKeys.length > 0
          ? prefs.compareKeys
          : DEFAULT_COMPARE_KEYS;

      const serializedFilters = serializeExplorerFilters(parsedFilters);
      isApplyingRemotePrefsRef.current = true;
      lastSavedSnapshotJsonRef.current = JSON.stringify({
        filters: serializedFilters,
        weights: nextWeights,
        activePresetId: nextPresetId,
        favorites: nextFavorites,
        compareKeys: nextCompareKeys,
      });
      lastSyncedUpdatedAtRef.current = prefs.updatedAt;

      applyFilterStateObject(parsedFilters);
      setWeights(nextWeights);
      setActivePresetId(nextPresetId);
      setFavoriteKeys(nextFavorites);
      setCompareKeys(nextCompareKeys);

      try {
        localStorage.setItem(
          "moradia_explorer_filters_v1",
          JSON.stringify(serializedFilters),
        );
        localStorage.setItem(
          "moradia_weights_v2",
          JSON.stringify({ presetId: nextPresetId, weights: nextWeights }),
        );
        localStorage.setItem(
          "moradia_favorites_v1",
          JSON.stringify(nextFavorites),
        );
        localStorage.setItem(
          "moradia_preferences_updated_at_v1",
          prefs.updatedAt,
        );
      } catch {
        // Ignore storage errors
      }
    },
    [applyFilterStateObject],
  );

  const pruneNeighborhoodsForCities = useCallback(
    (prevNeighborhoods: string[], nextCities: CityHubCode[]) => {
      if (nextCities.length === 0 || nextCities.length >= 4) {
        return prevNeighborhoods;
      }
      if (prevNeighborhoods.length === 0) {
        return prevNeighborhoods;
      }
      return prevNeighborhoods.filter((nb) => {
        const inProperties = dataset.properties.some(
          (p) =>
            nextCities.includes(p.cityCode) &&
            (p.neighborhood === nb ||
              normalizeNeighborhoodKey(p.neighborhood, p.cityCode) ===
                normalizeNeighborhoodKey(nb, p.cityCode)),
        );
        if (inProperties) return true;
        return dataset.neighborhoods.some(
          (n) =>
            nextCities.includes(n.cityCode) &&
            (n.neighborhood === nb ||
              normalizeNeighborhoodKey(n.neighborhood, n.cityCode) ===
                normalizeNeighborhoodKey(nb, n.cityCode)),
        );
      });
    },
    [dataset.properties, dataset.neighborhoods],
  );

  const handleCitySelect = useCallback(
    (city: CityHubCode | "ALL") => {
      if (city === "ALL") {
        setSelectedCities([]);
        setSelectedNeighborhoods([]);
        setVisibleCount(30);
        return;
      }
      const exists = selectedCities.includes(city);
      const rawNext = exists
        ? selectedCities.filter((c) => c !== city)
        : [...selectedCities, city];
      const maxAllCount = enableBsbBenchmark ? 5 : 4;
      const nextCities = rawNext.length >= maxAllCount ? [] : rawNext;
      setSelectedCities(nextCities);
      setSelectedNeighborhoods((prevNbs) =>
        pruneNeighborhoodsForCities(prevNbs, nextCities),
      );
      setVisibleCount(30);
    },
    [selectedCities, enableBsbBenchmark, pruneNeighborhoodsForCities],
  );

  const handleToggleBsbBenchmark = useCallback(() => {
    setEnableBsbBenchmark((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedCities((prevCities) =>
          prevCities.filter((c) => c !== "BSB"),
        );
        setSelectedNeighborhoods((prevNbs) =>
          prevNbs.filter((nb) => !/[aá]guas claras/i.test(nb)),
        );
      } else {
        setBenchmarkPanelCollapsed(false);
      }
      setVisibleCount(30);
      return next;
    });
  }, []);

  const resetAllFilters = () => {
    setSelectedCities([]);
    setSelectedNeighborhoods([]);
    setSearchQuery("");
    setFloorFilters([]);
    setMinTotalMonthly(null);
    setMaxTotalMonthly(null);
    setMaxCommuteMinutes(null);
    setMinScore(null);
    setSortBy("score_desc");
    setMinAreaM2(null);
    setMaxAreaM2(null);
    setSelectedBedrooms([]);
    setSelectedBathrooms([]);
    setSelectedParking([]);
    setMinBedrooms(null);
    setMinBathrooms(null);
    setMinParking(null);
    setModernityTiers([]);
    setMinModernityScore(null);
    setFurnishedFilter("ALL");
    setRequiredFeatures([]);
    setHideMegaCondo(false);
    setHideForSale(false);
    setOnlyNewEntries(false);
    setShowIneligible(false);
    setProviderFilter("ALL");
    setOnlyFavorites(false);
    setOnlyTop20Neighborhoods(false);
    setDeactivatedFilter("ACTIVE_ONLY");
    setVisibleCount(30);
  };

  useEffect(() => {
    try {
      const hasServerSavedFilters = Boolean(
        resolvedInitialPrefs?.filters &&
          Object.keys(resolvedInitialPrefs.filters).length > 0,
      );
      const serverUpdatedAtMs = resolvedInitialPrefs?.updatedAt
        ? Date.parse(resolvedInitialPrefs.updatedAt)
        : 0;
      const localUpdatedAtRaw = localStorage.getItem(
        "moradia_preferences_updated_at_v1",
      );
      const localUpdatedAtMs = localUpdatedAtRaw
        ? Date.parse(localUpdatedAtRaw)
        : 0;

      // Only fall back to localStorage if the shared DB has no saved filters yet
      // or if this browser has an explicit newer timestamp than the SSR snapshot.
      const shouldHydrateFromLocal =
        !hasServerSavedFilters ||
        (localUpdatedAtMs > 0 && localUpdatedAtMs > serverUpdatedAtMs);

      if (shouldHydrateFromLocal) {
        const rawWeights = localStorage.getItem("moradia_weights_v2");
        if (rawWeights) {
          const parsedWeights = JSON.parse(rawWeights) as {
            presetId?: string;
            weights?: Partial<ScoringWeights>;
          };
          if (parsedWeights && typeof parsedWeights === "object") {
            if (typeof parsedWeights.presetId === "string") {
              setActivePresetId(parsedWeights.presetId);
            }
            if (
              parsedWeights.weights &&
              typeof parsedWeights.weights === "object"
            ) {
              setWeights({ ...DEFAULT_WEIGHTS, ...parsedWeights.weights });
            }
          }
        }

        const rawFilters = localStorage.getItem("moradia_explorer_filters_v1");
        if (rawFilters) {
          const parsed = JSON.parse(rawFilters) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") {
            applyFilterStateObject(parseExplorerFiltersObject(parsed));
          }
        }

        const rawFavs = localStorage.getItem("moradia_favorites_v1");
        if (rawFavs) {
          const localFavs = (JSON.parse(rawFavs) as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          );
          if (localFavs.length > 0) {
            setFavoriteKeys((prev) => [...new Set([...prev, ...localFavs])]);
          }
        }
      } else if (resolvedInitialPrefs) {
        applySharedPreferencesToState(resolvedInitialPrefs);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setFiltersHydrated(true);
    }
  }, [
    resolvedInitialPrefs,
    applyFilterStateObject,
    applySharedPreferencesToState,
  ]);

  const syncPreferencesFromServer = useCallback(async () => {
    if (isDirtyRef.current) return;
    try {
      const res = await fetch("/api/preferences", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        preferences?: SharedUserPreferences;
      };
      if (!data.preferences || isDirtyRef.current) return;
      const remotePrefs = data.preferences;
      const remoteHasFilters =
        remotePrefs.filters && Object.keys(remotePrefs.filters).length > 0;
      if (!remoteHasFilters && !lastSyncedUpdatedAtRef.current) return;

      const remoteMs = Date.parse(remotePrefs.updatedAt || "");
      const currentMs = Date.parse(lastSyncedUpdatedAtRef.current || "");
      if (
        Number.isFinite(remoteMs) &&
        (!Number.isFinite(currentMs) || remoteMs > currentMs)
      ) {
        applySharedPreferencesToState(remotePrefs);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [applySharedPreferencesToState]);

  useEffect(() => {
    void syncPreferencesFromServer();
    const handleFocus = () => {
      void syncPreferencesFromServer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncPreferencesFromServer();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncPreferencesFromServer();
      }
    }, 10000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [syncPreferencesFromServer]);

  useEffect(() => {
    if (!filtersHydrated) return;
    const filtersPayload = serializeExplorerFilters({
      selectedCities,
      selectedNeighborhoods,
      searchQuery,
      floorFilter,
      floorFilters,
      minTotalMonthly,
      maxTotalMonthly,
      maxCommuteMinutes,
      minScore,
      sortBy,
      minAreaM2,
      maxAreaM2,
      selectedBedrooms,
      selectedBathrooms,
      selectedParking,
      minBedrooms,
      minBathrooms,
      minParking,
      modernityTiers,
      minModernityScore,
      furnishedFilter,
      requiredFeatures,
      hideMegaCondo,
      hideForSale,
      onlyNewEntries,
      showIneligible,
      providerFilter,
      onlyFavorites,
      onlyTop20Neighborhoods,
      enableBsbBenchmark,
      deactivatedFilter,
      showAdvancedFilters,
      viewMode,
    });

    try {
      localStorage.setItem(
        "moradia_explorer_filters_v1",
        JSON.stringify(filtersPayload),
      );
      localStorage.setItem(
        "moradia_weights_v2",
        JSON.stringify({ presetId: activePresetId, weights }),
      );
      localStorage.setItem(
        "moradia_favorites_v1",
        JSON.stringify(favoriteKeys),
      );
    } catch {
      // Ignore storage errors
    }

    const fullPayload = {
      filters: filtersPayload,
      weights,
      activePresetId,
      favorites: favoriteKeys,
      compareKeys,
    };
    const serialized = JSON.stringify(fullPayload);
    const wasApplyingRemote = isApplyingRemotePrefsRef.current;
    isApplyingRemotePrefsRef.current = false;
    if (wasApplyingRemote || serialized === lastSavedSnapshotJsonRef.current) {
      return;
    }

    isDirtyRef.current = true;
    const timer = setTimeout(() => {
      void fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {
            ok?: boolean;
            preferences?: SharedUserPreferences;
          };
          lastSavedSnapshotJsonRef.current = serialized;
          if (data.preferences?.updatedAt) {
            lastSyncedUpdatedAtRef.current = data.preferences.updatedAt;
            try {
              localStorage.setItem(
                "moradia_preferences_updated_at_v1",
                data.preferences.updatedAt,
              );
            } catch {
              // Ignore storage errors
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          isDirtyRef.current = false;
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [
    filtersHydrated,
    selectedCities,
    selectedNeighborhoods,
    searchQuery,
    floorFilter,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    sortBy,
    minAreaM2,
    maxAreaM2,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    providerFilter,
    onlyFavorites,
    onlyTop20Neighborhoods,
    enableBsbBenchmark,
    deactivatedFilter,
    showAdvancedFilters,
    viewMode,
    activePresetId,
    weights,
    favoriteKeys,
    compareKeys,
  ]);

  useEffect(() => {
    if (selectedCities.length > 0) {
      setScrapeCities(selectedCities);
    } else {
      setScrapeCities(["BH", "RJ", "CP", "SP"]);
    }
  }, [selectedCities]);

  const toggleFavorite = useCallback((key: string) => {
    setFavoriteKeys((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem("moradia_favorites_v1", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const updateWeight = <K extends keyof ScoringWeights>(
    key: K,
    value: ScoringWeights[K],
  ) => {
    setActivePresetId("custom");
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetId: string) => {
    const found = BUILTIN_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePresetId(found.id);
    setWeights(found.weights);
  };

  const toggleCompare = (key: string) => {
    setCompareKeys((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= 4
          ? [...prev.slice(1), key]
          : [...prev, key],
    );
  };

  const refreshDatasetFromServer = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/dataset?city=ALL", { cache: "no-store" });
      if (res.ok) {
        const fresh = (await res.json()) as MoradiaDatasetPayload;
        setDataset(fresh);
        if (fresh.preferences) {
          applySharedPreferencesToState(fresh.preferences);
        } else if (fresh.favorites && fresh.favorites.length > 0) {
          setFavoriteKeys((prev) => [
            ...new Set([...prev, ...(fresh.favorites ?? [])]),
          ]);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [applySharedPreferencesToState]);

  const fetchScrapeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scrape/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ScrapeJobStatus;
      setScrapeStatus(data);
      if (
        prevScrapeStatusRef.current === "running" &&
        data.status === "completed"
      ) {
        void refreshDatasetFromServer();
      }
      prevScrapeStatusRef.current = data.status;
    } catch {
      // Ignore polling errors
    }
  }, [refreshDatasetFromServer]);

  useEffect(() => {
    void fetchScrapeStatus();
  }, [fetchScrapeStatus]);

  useEffect(() => {
    if (scrapeStatus.status !== "running") return;
    const interval = setInterval(() => {
      void fetchScrapeStatus();
    }, 1500);
    return () => clearInterval(interval);
  }, [scrapeStatus.status, fetchScrapeStatus]);

  const fetchQaItems = useCallback(async () => {
    try {
      const res = await fetch("/api/qa", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        items?: PropertyQuestionItem[];
      };
      if (Array.isArray(data.items)) {
        setQaItems(data.items);
      }
    } catch {
      // Ignore polling errors
    }
  }, []);

  useEffect(() => {
    void fetchQaItems();
  }, [fetchQaItems]);

  const hasPendingQa = useMemo(
    () => qaItems.some((item) => item.status === "pending"),
    [qaItems],
  );

  useEffect(() => {
    if (!hasPendingQa && !showChatDrawer) return;
    const interval = setInterval(
      () => {
        void fetchQaItems();
      },
      hasPendingQa ? 1500 : 3500,
    );
    return () => clearInterval(interval);
  }, [hasPendingQa, showChatDrawer, fetchQaItems]);

  const openChatForProperty = useCallback(
    (propertyKey: string, scrollToMessages = false) => {
      setPinnedChatPropertyKey(propertyKey);
      if (scrollToMessages) {
        setChatScrollTargetKey(propertyKey);
      }
      setShowChatDrawer(true);
    },
    [],
  );

  const deletePropertyQuestion = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          items?: PropertyQuestionItem[];
        };
        if (Array.isArray(data.items)) {
          setQaItems(data.items);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  const clearChatHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (res.ok) {
        setQaItems([]);
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  const qaItemsByPropertyKey = useMemo(() => {
    const map = new Map<string, PropertyQuestionItem[]>();
    for (const item of qaItems) {
      const existing = map.get(item.propertyKey);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.propertyKey, [item]);
      }
    }
    return map;
  }, [qaItems]);

  const startScrapeJob = async (params: {
    mode: "full_sync" | "verify_only" | "custom_url";
    cities?: CityHubCode[];
    neighborhoods?: string[];
    customUrl?: string;
    keys?: string[];
  }) => {
    setIsStartingScrape(true);
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          ...params,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        status?: ScrapeJobStatus;
        error?: string;
      };
      if (json.status) {
        prevScrapeStatusRef.current = json.status.status;
        setScrapeStatus(json.status);
      }
    } finally {
      setIsStartingScrape(false);
    }
  };

  const cancelScrapeJob = async () => {
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const json = (await res.json()) as { status?: ScrapeJobStatus };
      if (json.status) {
        prevScrapeStatusRef.current = json.status.status;
        setScrapeStatus(json.status);
      }
    } catch {
      // Ignore cancel errors
    }
  };

  const toggleScrapeCity = (city: CityHubCode) => {
    setScrapeCities((prev) =>
      prev.includes(city)
        ? prev.length > 1
          ? prev.filter((c) => c !== city)
          : prev
        : [...prev, city],
    );
  };

  const { ranked: dynamicNeighborhoods, cityAverages } = useMemo(
    () =>
      computeDynamicNeighborhoods(dataset.neighborhoods, weights),
    [dataset.neighborhoods, weights],
  );

  const evaluatedProperties = useMemo(
    () =>
      computeDynamicProperties(
        dataset.properties,
        dynamicNeighborhoods,
        weights,
        { includeBsbBenchmark: enableBsbBenchmark },
      ),
    [dataset.properties, dynamicNeighborhoods, weights, enableBsbBenchmark],
  );

  const bsbBenchmarkStats = useMemo(() => {
    const medianOf = (nums: number[]): number => {
      if (nums.length === 0) return 0;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
        : Math.round(sorted[mid]!);
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

    const cityComparisons = (
      [
        {
          code: "BSB" as const,
          label: "Águas Claras (Norte & Sul)",
          neighborhoods: [
            "águas claras",
            "sul (águas claras)",
            "norte (águas claras)",
          ],
          minArea: 48,
          maxArea: 75,
          minMonthly: 2800,
          maxMonthly: 5800,
          minModernity: 60,
          requireParking: true,
          poolLevel: true,
        },
        {
          code: "CP" as const,
          label: "CP — Taquaral / Bosque / Guanabara",
          neighborhoods: [
            "taquaral",
            "bosque",
            "jd. guanabara",
            "nova campinas",
          ],
          minArea: 48,
          maxArea: 75,
          minMonthly: 2500,
          maxMonthly: 5400,
          minModernity: 0,
          requireParking: true,
          poolLevel: false,
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
          minArea: 48,
          maxArea: 75,
          minMonthly: 2800,
          maxMonthly: 5800,
          minModernity: 60,
          requireParking: true,
          poolLevel: false,
        },
        {
          code: "RJ" as const,
          label: "RJ — Zona Sul: Flamengo / Botafogo",
          neighborhoods: [
            "flamengo",
            "leme",
            "botafogo",
            "botafogo (orla)",
            "laranjeiras",
            "catete",
            "copacabana",
          ],
          minArea: 48,
          maxArea: 72,
          minMonthly: 4200,
          maxMonthly: 7800,
          minModernity: 0,
          requireParking: false,
          poolLevel: false,
        },
        {
          code: "SP" as const,
          label: "SP — Moema / V. Mariana / Pinheiros",
          neighborhoods: [
            "moema",
            "indianópolis",
            "vila mariana",
            "jardim paulista",
            "pinheiros",
            "sumaré",
          ],
          minArea: 48,
          maxArea: 72,
          minMonthly: 4200,
          maxMonthly: 7800,
          minModernity: 0,
          requireParking: true,
          poolLevel: false,
        },
      ]
    ).map((spec) => {
      const allowedNbs = new Set(spec.neighborhoods);
      const items = evaluatedProperties.filter((p) => {
        if (p.cityCode !== spec.code || p.isActive === false) return false;
        if (p.furnitureTier === "FULLY_FURNISHED" || p.furnished === true) {
          return false;
        }
        if (p.areaM2 < spec.minArea || p.areaM2 > spec.maxArea) return false;
        if (
          p.totalMonthly < spec.minMonthly ||
          p.totalMonthly > spec.maxMonthly
        ) {
          return false;
        }
        if (p.modernityScore < spec.minModernity) return false;
        if (spec.requireParking && p.parkingSpaces < 1) return false;
        const normNb = normalizeNeighborhoodKey(
          p.neighborhood ?? "",
          spec.code,
        ).toLowerCase();
        return allowedNbs.has(normNb);
      });

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
        if (list.length < 3 && !spec.poolLevel) continue;
        nbMonthlies.push(medianOf(list.map((x) => x.totalMonthly)));
        nbPm2s.push(
          medianOf(
            list.map((x) => Math.round(x.totalMonthly / Math.max(1, x.areaM2))),
          ),
        );
        nbScores.push(
          Math.round(
            (list.reduce((s, p) => s + p.finalScore, 0) / list.length) * 10,
          ) / 10,
        );
      }

      const usePool = spec.poolLevel || nbMonthlies.length === 0;
      const medianMonthly = usePool
        ? medianOf(items.map((p) => p.totalMonthly))
        : medianOf(nbMonthlies);
      const medianPm2 = usePool
        ? medianOf(
            items.map((p) =>
              Math.round(p.totalMonthly / Math.max(1, p.areaM2)),
            ),
          )
        : medianOf(nbPm2s);
      const medianScore = usePool
        ? items.length > 0
          ? Math.round(
              (items.reduce((s, p) => s + p.finalScore, 0) / items.length) * 10,
            ) / 10
          : 0
        : Math.round(
            (nbScores.reduce((a, b) => a + b, 0) / nbScores.length) * 10,
          ) / 10;

      return {
        code: spec.code,
        label: spec.label,
        totalEligible: items.length,
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
  }, [evaluatedProperties]);

  const availableNeighborhoodOptions = useMemo(() => {
    const countMap = new Map<string, { count: number; cityCode: CityHubCode }>();
    for (const p of evaluatedProperties) {
      if (!enableBsbBenchmark && p.cityCode === "BSB") continue;
      if (!showIneligible && !p.eligible) continue;
      if (selectedCities.length > 0 && !selectedCities.includes(p.cityCode)) {
        continue;
      }
      if (onlyTop20Neighborhoods && !isStrictlyInTop20Neighborhoods(p)) {
        continue;
      }
      const prev = countMap.get(p.neighborhood);
      if (prev) {
        prev.count += 1;
      } else {
        countMap.set(p.neighborhood, { count: 1, cityCode: p.cityCode });
      }
    }

    const rankScoreMap = new Map<string, number>();
    for (const n of dynamicNeighborhoods) {
      rankScoreMap.set(n.neighborhood, n.dynamicScore);
      rankScoreMap.set(
        normalizeNeighborhoodKey(n.neighborhood, n.cityCode),
        n.dynamicScore,
      );
    }

    return [...countMap.entries()]
      .map(([name, info]) => ({
        name,
        count: info.count,
        cityCode: info.cityCode,
        score:
          rankScoreMap.get(name) ??
          rankScoreMap.get(normalizeNeighborhoodKey(name, info.cityCode)) ??
          0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.count - a.count ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
  }, [
    evaluatedProperties,
    enableBsbBenchmark,
    selectedCities,
    showIneligible,
    onlyTop20Neighborhoods,
    dynamicNeighborhoods,
  ]);

  const currentExplorerFilters: PropertyExplorerFilters = useMemo(
    () => ({
      selectedCity: selectedCities.length === 1 ? selectedCities[0]! : "ALL",
      selectedCities,
      searchQuery,
      floorFilter,
      floorFilters,
      minTotalMonthly,
      maxTotalMonthly,
      maxCommuteMinutes,
      minScore,
      sortBy,
      selectedNeighborhoods,
      minAreaM2,
      maxAreaM2,
      selectedBedrooms,
      selectedBathrooms,
      selectedParking,
      minBedrooms,
      minBathrooms,
      minParking,
      modernityTiers,
      minModernityScore,
      furnishedFilter,
      requiredFeatures,
      hideMegaCondo,
      hideForSale,
      onlyNewEntries,
      showIneligible,
      providerFilter,
      onlyFavorites,
      onlyTop20Neighborhoods,
      enableBsbBenchmark,
      deactivatedFilter,
      favoriteKeys,
    }),
    [
      selectedCities,
      searchQuery,
      floorFilter,
      floorFilters,
      minTotalMonthly,
      maxTotalMonthly,
      maxCommuteMinutes,
      minScore,
      sortBy,
      selectedNeighborhoods,
      minAreaM2,
      maxAreaM2,
      selectedBedrooms,
      selectedBathrooms,
      selectedParking,
      minBedrooms,
      minBathrooms,
      minParking,
      modernityTiers,
      minModernityScore,
      furnishedFilter,
      requiredFeatures,
      hideMegaCondo,
      hideForSale,
      onlyNewEntries,
      showIneligible,
      providerFilter,
      onlyFavorites,
      onlyTop20Neighborhoods,
      enableBsbBenchmark,
      deactivatedFilter,
      favoriteKeys,
    ],
  );

  const filteredProperties = useMemo(
    () =>
      filterAndSortProperties(
        evaluatedProperties,
        currentExplorerFilters,
        favoriteKeys,
      ),
    [evaluatedProperties, currentExplorerFilters, favoriteKeys],
  );

  const pinnedChatProperty = useMemo(() => {
    if (!pinnedChatPropertyKey) return null;
    const found =
      evaluatedProperties.find(
        (p) => `${p.provider}:${p.id}` === pinnedChatPropertyKey,
      ) ?? null;
    if (!found) return null;
    const extraPhotos = extraPhotosByKey[pinnedChatPropertyKey];
    if (extraPhotos && extraPhotos.length > found.samplePhotos.length) {
      return { ...found, samplePhotos: extraPhotos };
    }
    return found;
  }, [pinnedChatPropertyKey, evaluatedProperties, extraPhotosByKey]);

  const submitChatQuestion = useCallback(
    async ({
      question,
      property,
    }: {
      question: string;
      property: EvaluatedProperty | null;
    }) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const key = property ? `${property.provider}:${property.id}` : "general";

      const topContextLines = filteredProperties
        .slice(0, 5)
        .map(
          (p, idx) =>
            `${idx + 1}. #${p.overallRank ?? idx + 1} ${p.neighborhood} (${p.cityCode}) — ${p.street}: ${p.finalScore.toFixed(1)} pts · R$ ${p.totalMonthly.toLocaleString("pt-BR")}/mês · ${p.areaM2} m²`,
        )
        .join("\n");

      setIsSubmittingChatQuestion(true);
      try {
        const res = await fetch("/api/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ask",
            propertyKey: key,
            question: trimmed,
            contextSummary:
              filteredProperties.length > 0
                ? `Filtro atual na tela (${filteredProperties.length} imóveis):\n${topContextLines}`
                : undefined,
            propertySnapshot: property
              ? {
                  title: property.title,
                  neighborhood: property.neighborhood,
                  cityCode: property.cityCode,
                  street: property.street,
                  streetNumber: property.streetNumber,
                  condominiumName: property.condominiumName,
                  totalMonthly: property.totalMonthly,
                  rent: property.rent,
                  condoFee: property.condoFee,
                  iptu: property.iptu,
                  areaM2: property.areaM2,
                  bedrooms: property.bedrooms,
                  bathrooms: property.bathrooms,
                  parkingSpaces: property.parkingSpaces,
                  floor: property.floor,
                  floorLabel: property.cardTags.floorTag?.label ?? null,
                  furnished: property.furnished,
                  modernityScore: property.modernityScore,
                  finalScore: property.finalScore,
                  overallRank: property.overallRank,
                  cityRank: property.cityRank,
                  furnitureTier: property.furnitureTier,
                  url: property.url,
                  shortJustification: property.shortJustification,
                  description:
                    property.description ??
                    property.generatedDescription ??
                    null,
                  thumbnailUrl: property.samplePhotos[0]?.url ?? null,
                  suites: property.suites,
                  totalFloors: property.totalFloors,
                  floorRange: property.floorRange,
                  constructionYear: property.constructionYear,
                  doorman: property.doorman,
                  acLabel: property.cardTags.acLabel,
                  greenTags: property.cardTags.greenTags,
                  redTags: property.cardTags.redTags,
                  nuanceHighlights: property.nuanceHighlights,
                  nuanceWarnings: property.nuanceWarnings,
                  breakdown: property.breakdown,
                }
              : undefined,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          items?: PropertyQuestionItem[];
        };
        if (!res.ok || data.ok === false) {
          throw new Error(
            data.error ??
              "Não foi possível enviar sua pergunta. Tente novamente.",
          );
        }
        if (Array.isArray(data.items)) {
          setQaItems(data.items);
        }
        return true;
      } finally {
        setIsSubmittingChatQuestion(false);
      }
    },
    [filteredProperties],
  );

  const deactivatedTotalCount = useMemo(
    () =>
      evaluatedProperties.filter(
        (p) =>
          (enableBsbBenchmark || p.cityCode !== "BSB") &&
          p.isActive === false,
      ).length,
    [evaluatedProperties, enableBsbBenchmark],
  );

  const totalBasePoolCount = useMemo(
    () =>
      evaluatedProperties.filter((p) => {
        if (!enableBsbBenchmark && p.cityCode === "BSB") return false;
        if (deactivatedFilter === "ACTIVE_ONLY" && !onlyFavorites && p.isActive === false) {
          return false;
        }
        if (deactivatedFilter === "DEACTIVATED_ONLY" && p.isActive !== false) {
          return false;
        }
        return showIneligible || onlyFavorites ? true : p.eligible;
      }).length,
    [evaluatedProperties, enableBsbBenchmark, showIneligible, deactivatedFilter, onlyFavorites],
  );

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (selectedNeighborhoods.length > 0) count += selectedNeighborhoods.length;
    if (floorFilters.length > 0) count += floorFilters.length;
    if (minTotalMonthly !== null || maxTotalMonthly !== null) count += 1;
    if (maxCommuteMinutes !== null) count += 1;
    if (minScore !== null) count += 1;
    if (minAreaM2 !== null || maxAreaM2 !== null) count += 1;
    if (selectedBedrooms.length > 0 || minBedrooms !== null) count += 1;
    if (selectedBathrooms.length > 0 || minBathrooms !== null) count += 1;
    if (selectedParking.length > 0 || minParking !== null) count += 1;
    if (modernityTiers.length > 0) count += modernityTiers.length;
    if (minModernityScore !== null) count += 1;
    if (furnishedFilter !== "ALL") count += 1;
    if (requiredFeatures.length > 0) count += requiredFeatures.length;
    if (hideMegaCondo) count += 1;
    if (hideForSale) count += 1;
    if (onlyNewEntries) count += 1;
    if (showIneligible) count += 1;
    if (providerFilter !== "ALL") count += 1;
    if (onlyTop20Neighborhoods) count += 1;
    if (deactivatedFilter !== "ACTIVE_ONLY") count += 1;
    return count;
  }, [
    selectedNeighborhoods,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    minAreaM2,
    maxAreaM2,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    providerFilter,
    onlyTop20Neighborhoods,
    deactivatedFilter,
  ]);

  const activeFilterPills = useMemo(() => {
    const pills: { id: string; label: string; onClear: () => void }[] = [];

    for (const city of selectedCities) {
      pills.push({
        id: `city-${city}`,
        label: `Praça: ${city}`,
        onClear: () => handleCitySelect(city),
      });
    }
    if (searchQuery.trim()) {
      pills.push({
        id: "search",
        label: `Busca: "${searchQuery.trim()}"`,
        onClear: () => setSearchQuery(""),
      });
    }
    for (const ff of floorFilters) {
      const opt = FLOOR_FILTER_OPTIONS.find((o) => o.value === ff);
      pills.push({
        id: `floor-${ff}`,
        label: opt ? opt.label : `Andar: ${ff}`,
        onClear: () =>
          setFloorFilters((prev) => prev.filter((item) => item !== ff)),
      });
    }
    if (minTotalMonthly !== null || maxTotalMonthly !== null) {
      const label =
        minTotalMonthly !== null && maxTotalMonthly !== null
          ? `R$ ${minTotalMonthly.toLocaleString("pt-BR")}–R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
          : maxTotalMonthly !== null
            ? `≤ R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
            : `≥ R$ ${(minTotalMonthly ?? 0).toLocaleString("pt-BR")}`;
      pills.push({
        id: "price",
        label,
        onClear: () => {
          setMinTotalMonthly(null);
          setMaxTotalMonthly(null);
        },
      });
    }
    if (maxCommuteMinutes !== null) {
      pills.push({
        id: "commute",
        label: `Tempo ≤ ${maxCommuteMinutes} min`,
        onClear: () => setMaxCommuteMinutes(null),
      });
    }
    if (minScore !== null) {
      pills.push({
        id: "score",
        label: `Nota ≥ ${minScore} pts`,
        onClear: () => setMinScore(null),
      });
    }
    if (sortBy !== "score_desc") {
      const sortOpt = SORT_BY_OPTIONS.find((s) => s.value === sortBy);
      pills.push({
        id: "sort",
        label: `Ordem: ${sortOpt?.label ?? sortBy}`,
        onClear: () => setSortBy("score_desc"),
      });
    }
    for (const nb of selectedNeighborhoods) {
      pills.push({
        id: `nb-${nb}`,
        label: `Bairro: ${nb}`,
        onClear: () =>
          setSelectedNeighborhoods((prev) => prev.filter((item) => item !== nb)),
      });
    }
    if (minAreaM2 !== null || maxAreaM2 !== null) {
      const label =
        minAreaM2 !== null && maxAreaM2 !== null
          ? `${minAreaM2}–${maxAreaM2} m²`
          : minAreaM2 !== null
            ? `≥ ${minAreaM2} m²`
            : `≤ ${maxAreaM2} m²`;
      pills.push({
        id: "area",
        label: `Área: ${label}`,
        onClear: () => {
          setMinAreaM2(null);
          setMaxAreaM2(null);
        },
      });
    }
    if (selectedBedrooms.length > 0) {
      const labelNums = [...selectedBedrooms]
        .sort((a, b) => a - b)
        .map((n) => (n >= 3 ? "3+" : String(n)))
        .join(", ");
      pills.push({
        id: "bedrooms",
        label: `Quartos: ${labelNums}`,
        onClear: () => {
          setSelectedBedrooms([]);
          setMinBedrooms(null);
        },
      });
    } else if (minBedrooms !== null) {
      pills.push({
        id: "bedrooms",
        label: `${minBedrooms}+ quartos`,
        onClear: () => setMinBedrooms(null),
      });
    }
    if (selectedBathrooms.length > 0) {
      const labelNums = [...selectedBathrooms]
        .sort((a, b) => a - b)
        .map((n) => (n >= 3 ? "3+" : String(n)))
        .join(", ");
      pills.push({
        id: "bathrooms",
        label: `Banheiros: ${labelNums}`,
        onClear: () => {
          setSelectedBathrooms([]);
          setMinBathrooms(null);
        },
      });
    } else if (minBathrooms !== null) {
      pills.push({
        id: "bathrooms",
        label: `${minBathrooms}+ banheiros`,
        onClear: () => setMinBathrooms(null),
      });
    }
    if (selectedParking.length > 0) {
      const labelNums = [...selectedParking]
        .sort((a, b) => a - b)
        .map((n) => (n >= 2 ? "2+" : String(n)))
        .join(", ");
      pills.push({
        id: "parking",
        label: `Vagas: ${labelNums}`,
        onClear: () => {
          setSelectedParking([]);
          setMinParking(null);
        },
      });
    } else if (minParking !== null) {
      pills.push({
        id: "parking",
        label: `≥ ${minParking} vaga(s)`,
        onClear: () => setMinParking(null),
      });
    }
    for (const tier of modernityTiers) {
      const tierLabel =
        MODERNITY_TIER_BADGES[tier]?.label.replace("Estado: ", "") ?? tier;
      pills.push({
        id: `tier-${tier}`,
        label: `Estado: ${tierLabel}`,
        onClear: () =>
          setModernityTiers((prev) => prev.filter((t) => t !== tier)),
      });
    }
    if (minModernityScore !== null) {
      pills.push({
        id: "min-mod",
        label: `Modernidade ≥ ${minModernityScore}/100`,
        onClear: () => setMinModernityScore(null),
      });
    }
    if (furnishedFilter !== "ALL") {
      const furnishedPillLabels: Record<
        Exclude<FurnishedFilterOption, "ALL">,
        string
      > = {
        UNFURNISHED: "Sem mobília",
        UNFURNISHED_OR_SEMI: "Sem mobília ou Semi",
        SEMI_FURNISHED: "Só Semi-mobiliado",
        FURNISHED: "Mobiliado",
      };
      pills.push({
        id: "furnished",
        label: furnishedPillLabels[furnishedFilter],
        onClear: () => setFurnishedFilter("ALL"),
      });
    }
    for (const feat of requiredFeatures) {
      const fOpt = PROPERTY_FEATURE_OPTIONS.find((f) => f.key === feat);
      pills.push({
        id: `feat-${feat}`,
        label: fOpt?.label ?? feat,
        onClear: () =>
          setRequiredFeatures((prev) => prev.filter((f) => f !== feat)),
      });
    }
    if (hideMegaCondo) {
      pills.push({
        id: "no-megacondo",
        label: "Sem Megacondomínio",
        onClear: () => setHideMegaCondo(false),
      });
    }
    if (hideForSale) {
      pills.push({
        id: "no-forsale",
        label: "Sem imóveis à venda",
        onClear: () => setHideForSale(false),
      });
    }
    if (onlyNewEntries) {
      pills.push({
        id: "new-entries",
        label: "Só Novas Entradas",
        onClear: () => setOnlyNewEntries(false),
      });
    }
    if (showIneligible) {
      pills.push({
        id: "show-ineligible",
        label: "Incluindo reprovados",
        onClear: () => setShowIneligible(false),
      });
    }
    if (providerFilter !== "ALL") {
      pills.push({
        id: "provider",
        label: getProviderStyle(providerFilter).label,
        onClear: () => setProviderFilter("ALL"),
      });
    }
    if (onlyFavorites) {
      pills.push({
        id: "only-favorites",
        label: `♥ Favoritos (${favoriteKeys.length})`,
        onClear: () => setOnlyFavorites(false),
      });
    }
    if (onlyTop20Neighborhoods) {
      pills.push({
        id: "only-top-20-neighborhoods",
        label: "Só Top 20 Bairros",
        onClear: () => setOnlyTop20Neighborhoods(false),
      });
    }
    if (deactivatedFilter !== "ACTIVE_ONLY") {
      pills.push({
        id: "deactivated-filter",
        label:
          deactivatedFilter === "ALL"
            ? "Incluindo Desativados / Alugados"
            : "Só Desativados / Alugados",
        onClear: () => setDeactivatedFilter("ACTIVE_ONLY"),
      });
    }

    return pills;
  }, [
    selectedCities,
    handleCitySelect,
    searchQuery,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    sortBy,
    selectedNeighborhoods,
    minAreaM2,
    maxAreaM2,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    providerFilter,
    onlyFavorites,
    onlyTop20Neighborhoods,
    favoriteKeys.length,
    deactivatedFilter,
  ]);

  const [copiedTop50Count, setCopiedTop50Count] = useState<number | null>(null);
  const copyTop50TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyTop50ForAi = useCallback(async () => {
    if (filteredProperties.length === 0) return;
    const countToCopy = Math.min(50, filteredProperties.length);
    const text = formatTopPropertiesForAiPrompt(filteredProperties, {
      activeFilterLabels: activeFilterPills.map((p) => p.label),
      favoriteKeys: new Set(favoriteKeys),
      limit: 50,
    });

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedTop50Count(countToCopy);
    if (copyTop50TimerRef.current) {
      clearTimeout(copyTop50TimerRef.current);
    }
    copyTop50TimerRef.current = setTimeout(() => {
      setCopiedTop50Count(null);
    }, 2500);
  }, [filteredProperties, activeFilterPills, favoriteKeys]);

  const comparedProperties = useMemo(
    () =>
      compareKeys
        .map((k) =>
          evaluatedProperties.find((p) => `${p.provider}:${p.id}` === k),
        )
        .filter((p): p is EvaluatedProperty => Boolean(p)),
    [compareKeys, evaluatedProperties],
  );

  useEffect(() => {
    if (!expandedId || fetchedPhotoKeysRef.current.has(expandedId)) return;
    const prop = evaluatedProperties.find(
      (p) => `${p.provider}:${p.id}` === expandedId,
    );
    if (!prop?.url) return;
    const currentPhotos =
      extraPhotosByKey[expandedId] ?? prop.samplePhotos ?? [];
    const expectedCount = prop.photosCount ?? 0;
    if (expectedCount <= currentPhotos.length && currentPhotos.length > 6) {
      return;
    }

    fetchedPhotoKeysRef.current.add(expandedId);
    let cancelled = false;
    const q = new URLSearchParams({
      provider: prop.provider,
      id: prop.id,
      url: prop.url,
    });
    void fetch(`/api/photos?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          res: {
            ok?: boolean;
            photos?: Array<{ room: string | null; url: string }>;
          } | null,
        ) => {
          if (cancelled) return;
          if (
            res?.ok &&
            Array.isArray(res.photos) &&
            res.photos.length > currentPhotos.length
          ) {
            setExtraPhotosByKey((prev) => ({
              ...prev,
              [expandedId]: res.photos!,
            }));
          }
        },
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [expandedId, evaluatedProperties, extraPhotosByKey]);

  const cityTop3ByCode = useMemo(() => {
    const map = new Map<
      CityHubCode,
      { top3Avg: number; top3Names: string[]; cityName: string }
    >();
    for (const c of cityAverages) {
      map.set(c.cityCode, {
        top3Avg: c.top3Avg,
        top3Names: c.top3Names,
        cityName: c.cityName,
      });
    }
    return map;
  }, [cityAverages]);

  return (
    <div className="space-y-3">
      {/* Compact Top Header */}
      <header className="flex items-center justify-between gap-1 rounded-xl border bg-card px-2 py-2 shadow-xs sm:flex-wrap sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#9333ea] via-[#820AD1] to-[#581c87] text-white shadow-sm ring-1 ring-purple-400/30 sm:h-9 sm:w-9">
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5"
            >
              <path
                d="M6.5 15.5A9.5 9.5 0 0 1 25.5 15.5"
                fill="none"
                stroke="#E9D5FF"
                strokeOpacity="0.5"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M7 16.5L12 14V25H7V16.5Z"
                fill="#D8B4FE"
                fillOpacity="0.85"
              />
              <path
                d="M11.5 11.5L16 7L20.5 11.5V25H11.5V11.5Z"
                fill="#FFFFFF"
              />
              <path
                d="M20.5 14.5L25 16.5V25H20.5V14.5Z"
                fill="#C084FC"
                fillOpacity="0.9"
              />
              <rect x="13.5" y="12.5" width="2" height="2" rx="0.5" fill="#6B21A8" />
              <rect x="16.5" y="12.5" width="2" height="2" rx="0.5" fill="#6B21A8" />
              <rect x="13.5" y="16" width="2" height="2" rx="0.5" fill="#6B21A8" />
              <rect x="16.5" y="16" width="2" height="2" rx="0.5" fill="#6B21A8" />
              <rect x="14.75" y="20" width="2.5" height="5" rx="0.75" fill="#581C87" />
              <circle cx="16" cy="5.25" r="1.5" fill="#FDE047" />
              <path
                d="M5.5 25H26.5"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 whitespace-nowrap sm:flex-wrap sm:gap-2">
              <h1 className="text-xs font-bold tracking-tight sm:text-lg">
                Housing
              </h1>
              <span className="hidden sm:inline-block rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                BH · CP · RJ · SP
              </span>
              {dataset.updatedAt && (
                <span
                  title={`Snapshot gerado em ${dataset.updatedAt} (fonte: ${dataset.source})`}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 sm:gap-1.5 sm:px-2 sm:text-[10px]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="sm:hidden">
                    {dataset.properties.length.toLocaleString("pt-BR")} apês ·{" "}
                    {new Date(dataset.updatedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="hidden sm:inline">
                    Base:{" "}
                    {new Date(dataset.updatedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {dataset.properties.length.toLocaleString("pt-BR")}{" "}
                    imóveis
                    {dataset.properties.some((p) => p.isNewEntry) &&
                      ` (${dataset.properties.filter((p) => p.isNewEntry).length} novos)`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Ranking dinâmico de imóveis e 20 bairros avaliados em tempo real
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:flex-wrap sm:gap-1.5">
          <button
            type="button"
            onClick={() => setShowScrapeDrawer((v) => !v)}
            title="Atualizar Anúncios e Verificar Disponibilidade (Scrape)"
            aria-label="Atualizar Anúncios e Verificar Disponibilidade (Scrape)"
            aria-expanded={showScrapeDrawer}
            className={`inline-flex h-7 w-7 sm:w-auto sm:h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all sm:px-2.5 ${
              scrapeStatus.status === "running"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/30"
                : showScrapeDrawer
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {scrapeStatus.status === "running" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radar className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {scrapeStatus.status === "running"
                ? "Atualizando Base..."
                : "Atualizar Anúncios"}
            </span>
            {scrapeStatus.status === "running" && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={refreshDatasetFromServer}
            disabled={isRefreshing}
            title="Recarregar dados do servidor"
            aria-label="Recarregar dados do servidor"
            className="hidden sm:inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>
              {isRefreshing ? "Sincronizando..." : "Recarregar"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowChatDrawer((v) => !v)}
            title="Abrir Chat & Consultor da Sessão (⌘J)"
            aria-label="Abrir Chat & Consultor da Sessão"
            aria-expanded={showChatDrawer}
            className={`inline-flex h-7 sm:h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-all sm:px-2.5 ${
              showChatDrawer
                ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                : "border-purple-500/40 bg-purple-500/10 text-purple-800 hover:bg-purple-500/20 dark:border-purple-400/40 dark:bg-purple-500/20 dark:text-purple-200"
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
            <span>Chat ({qaItems.length})</span>
            {hasPendingQa && (
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSlidersDrawer((v) => !v)}
            title="Calibrador de Critérios e Pesos"
            aria-label="Calibrador de Critérios e Pesos"
            aria-pressed={showSlidersDrawer}
            className={`inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border transition-all ${
              showSlidersDrawer
                ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/40"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <ThemeToggle />
          <a
            href="https://joaog.space"
            title="Voltar para joaog.space"
            aria-label="Voltar para joaog.space"
            className="inline-flex h-7 w-7 sm:w-auto sm:h-8 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-secondary sm:px-2.5"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← joaog.space</span>
          </a>
        </div>
      </header>

      {/* Painel de 1 Clique: Atualizar Anúncios (Scrape) & Verificador de Desativados */}
      {showScrapeDrawer && (
        <section className="rounded-xl border border-primary/30 bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                Painel de Scrape e Atualização de Anúncios em Tempo Real
              </h2>
              <p className="text-xs text-muted-foreground">
                Busque novos apartamentos nos portais e verifique quais anúncios
                foram alugados/desativados. Anúncios que saíram do ar não são
                excluídos — ficam marcados como{" "}
                <strong className="text-rose-600 dark:text-rose-400">
                  Desativado / Alugado
                </strong>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScrapeDrawer(false)}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* 1. Escopo de Praças e Bairros */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-foreground">
                  1. Escopo de Praças & Bairros
                </span>
                <button
                  type="button"
                  onClick={() => setScrapeCities(["BH", "RJ", "CP", "SP"])}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Selecionar todas
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["BH", "RJ", "CP", "SP"] as const).map((c) => {
                  const checked = scrapeCities.includes(c);
                  return (
                    <button
                      key={`scrape-city-${c}`}
                      type="button"
                      onClick={() => toggleScrapeCity(c)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="pointer-events-none h-3 w-3 accent-primary"
                      />
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedNeighborhoods.length > 0 ? (
                  <>
                    Bairros filtrados ativos:{" "}
                    <strong className="text-foreground">
                      {selectedNeighborhoods.join(", ")}
                    </strong>
                  </>
                ) : (
                  "Todos os bairros-alvo configurados nas praças selecionadas."
                )}
              </p>
            </div>

            {/* 2. Ações Rápidas com 1 Clique */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-foreground">
                2. Sincronização com 1 Clique
              </span>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={
                    scrapeStatus.status === "running" || isStartingScrape
                  }
                  onClick={() =>
                    void startScrapeJob({
                      mode: "full_sync",
                      cities: scrapeCities,
                      neighborhoods: selectedNeighborhoods,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>
                    Buscar Novos + Atualizar Desativados (
                    {scrapeCities.join(", ")})
                  </span>
                </button>

                <button
                  type="button"
                  disabled={
                    scrapeStatus.status === "running" || isStartingScrape
                  }
                  onClick={() => {
                    const topActiveKeys = filteredProperties
                      .filter((p) => p.isActive !== false)
                      .slice(0, 25)
                      .map((p) => `${p.provider}:${p.id}`);
                    const keysToVerify = [
                      ...new Set([...favoriteKeys, ...topActiveKeys]),
                    ];
                    void startScrapeJob({
                      mode: "verify_only",
                      cities: scrapeCities,
                      keys: keysToVerify,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-200"
                >
                  <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                  <span>
                    Verificar Favoritos ({favoriteKeys.length}) e Top Imóveis
                    (Rápido)
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Adicionar Nova URL de Busca */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-foreground">
                3. Adicionar URL de Busca
              </span>
              <p className="text-[11px] text-muted-foreground">
                Cole uma URL de busca do QuintoAndar, Zap Imóveis, VivaReal,
                Netimóveis ou Imovelweb:
              </p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    value={customSearchUrl}
                    onChange={(e) => setCustomSearchUrl(e.target.value)}
                    placeholder="https://www.quintoandar.com.br/alugar/imovel/..."
                    className="w-full rounded-lg border bg-card pl-8 pr-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    !customSearchUrl.trim() ||
                    scrapeStatus.status === "running" ||
                    isStartingScrape
                  }
                  onClick={() =>
                    void startScrapeJob({
                      mode: "custom_url",
                      cities: scrapeCities,
                      customUrl: customSearchUrl.trim(),
                    })
                  }
                  className="shrink-0 rounded-lg border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                >
                  Extrair URL
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Progresso ao Vivo */}
          {scrapeStatus.status !== "idle" && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {scrapeStatus.status === "running" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-200">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Em execução
                    </span>
                  ) : scrapeStatus.status === "completed" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
                      Interrompido / Falhou
                    </span>
                  )}
                  <span className="font-semibold text-foreground">
                    {scrapeStatus.phase ?? "Processando..."}
                  </span>
                  {scrapeStatus.currentSearchLabel && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ({scrapeStatus.currentSearchLabel})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                    +{scrapeStatus.newListingsAdded ?? 0} novos anúncios
                  </span>
                  <span className="rounded bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
                    {scrapeStatus.deactivatedCount ?? 0} marcados como
                    desativados
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">
                    {scrapeStatus.verifiedCount ?? 0} verificados
                  </span>

                  {scrapeStatus.status === "running" && (
                    <button
                      type="button"
                      onClick={() => void cancelScrapeJob()}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-rose-800 hover:bg-rose-500/25 dark:text-rose-200"
                    >
                      <Square className="h-3 w-3" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(() => {
                const completed = scrapeStatus.completedSteps ?? 0;
                const total = Math.max(1, scrapeStatus.totalSteps ?? 1);
                const pct =
                  scrapeStatus.status === "completed"
                    ? 100
                    : Math.min(98, Math.round((completed / total) * 100));
                return (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full transition-all duration-300 ${
                          scrapeStatus.status === "failed"
                            ? "bg-rose-500"
                            : scrapeStatus.status === "completed"
                              ? "bg-emerald-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>
                        Etapa {completed} de {total} ({pct}%)
                      </span>
                      {scrapeStatus.updatedAt && (
                        <span>
                          Atualizado às{" "}
                          {new Date(scrapeStatus.updatedAt).toLocaleTimeString(
                            "pt-BR",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {scrapeStatus.error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {scrapeStatus.error}
                </p>
              )}

              {scrapeStatus.logs && scrapeStatus.logs.length > 0 && (
                <details className="rounded border bg-background/70 p-2 text-[11px]">
                  <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                    Logs ao vivo ({scrapeStatus.logs.length} linhas)
                  </summary>
                  <pre className="mt-1.5 max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {scrapeStatus.logs.slice(-30).join("\n")}
                  </pre>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {/* Interactive Weight Calibrator Panel */}
      {showSlidersDrawer && (
        <section className="rounded-xl border bg-card p-5 shadow-xs space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Calibrador de Critérios e Pesos em Tempo Real
              </h2>
              <p className="text-xs text-muted-foreground">
                Altere qualquer peso ou limite abaixo para reordenar os imóveis
                e os 20 bairros instantaneamente e reconstruir as
                justificativas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {BUILTIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  title={preset.description}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    activePresetId === preset.id
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background hover:bg-secondary"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset("balanced-original")}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Property Weights */}
            <div className="space-y-3 rounded-lg border bg-background/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                1. Pesos e Limites dos Imóveis
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Peso da Nota do Bairro</span>
                    <span className="font-mono text-primary">
                      {weights.neighborhoodMultiplier.toFixed(1)}x (até{" "}
                      {(10 * weights.neighborhoodMultiplier).toFixed(0)} pts)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={weights.neighborhoodMultiplier}
                    onChange={(e) =>
                      updateWeight(
                        "neighborhoodMultiplier",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Peso Anti-Velharia (Modernidade)</span>
                    <span className="font-mono text-primary">
                      {weights.modernityMultiplier.toFixed(2)}x (até{" "}
                      {(100 * weights.modernityMultiplier).toFixed(0)} pts)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.4}
                    step={0.05}
                    value={weights.modernityMultiplier}
                    onChange={(e) =>
                      updateWeight(
                        "modernityMultiplier",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Peso das Nuances (Sol, Vista, Andar, Parques)</span>
                    <span className="font-mono text-primary">
                      {(weights.nuancesMultiplier ?? 1).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.nuancesMultiplier ?? 1}
                    onChange={(e) =>
                      updateWeight("nuancesMultiplier", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Corte Mínimo Modernidade (0–100)</span>
                    <span className="font-mono text-primary">
                      ≥ {weights.minModernityScore}/100
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={85}
                    step={2}
                    value={weights.minModernityScore}
                    onChange={(e) =>
                      updateWeight("minModernityScore", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Teto Ideal All-in (R$)</span>
                    <span className="font-mono text-primary">
                      R$ {weights.budgetIdeal.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3200}
                    max={7000}
                    step={100}
                    value={weights.budgetIdeal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateWeight("budgetIdeal", val);
                      if (weights.budgetMax < val) {
                        updateWeight("budgetMax", val + 500);
                      }
                    }}
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Teto Limite Tolerado (R$)</span>
                    <span className="font-mono text-primary">
                      R$ {weights.budgetMax.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3600}
                    max={8000}
                    step={100}
                    value={weights.budgetMax}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateWeight("budgetMax", val);
                      updateWeight("budgetHardCap", val + 350);
                    }}
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Bônus Não-Mobiliado (p/ Mobília BSB)</span>
                    <span className="font-mono text-primary">
                      +{weights.unfurnishedBonus} pts
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={weights.unfurnishedBonus}
                    onChange={(e) =>
                      updateWeight("unfurnishedBonus", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Penalidade Imóvel Mobiliado</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      {weights.furnishedPenalty} pts
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={0}
                    step={1}
                    value={weights.furnishedPenalty}
                    onChange={(e) =>
                      updateWeight("furnishedPenalty", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Área Útil Mínima (m²)</span>
                    <span className="font-mono text-primary">
                      {weights.minAreaM2} m² a {weights.maxAreaM2} m²
                    </span>
                  </div>
                  <input
                    type="range"
                    min={35}
                    max={65}
                    step={1}
                    value={weights.minAreaM2}
                    onChange={(e) =>
                      updateWeight("minAreaM2", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <div className="flex items-center justify-between pt-3 text-xs">
                  <span className="font-medium">
                    Exigir ≥ 1 Vaga de Garagem
                  </span>
                  <input
                    type="checkbox"
                    checked={weights.requireParking}
                    onChange={(e) =>
                      updateWeight("requireParking", e.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 text-xs">
                  <span className="font-medium">
                    Penalizar Megacondomínio Familiar
                  </span>
                  <input
                    type="checkbox"
                    checked={weights.penalizeMegaCondo ?? true}
                    onChange={(e) =>
                      updateWeight("penalizeMegaCondo", e.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* Neighborhood Sub-weights */}
            <div className="space-y-3 rounded-lg border bg-background/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                2. Sub-Pesos de Avaliação dos 20 Bairros
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Respiração Urbana (Vibe Setor Marista)</span>
                    <span className="font-mono text-primary">
                      {weights.urbanBreathingWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.urbanBreathingWeight}
                    onChange={(e) =>
                      updateWeight(
                        "urbanBreathingWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Logística & Tempo p/ Escritório Nubank</span>
                    <span className="font-mono text-primary">
                      {weights.commuteLogisticsWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.commuteLogisticsWeight}
                    onChange={(e) =>
                      updateWeight(
                        "commuteLogisticsWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Oferta de Prédios Bons c/ Vaga</span>
                    <span className="font-mono text-primary">
                      {weights.buildingStockWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.buildingStockWeight}
                    onChange={(e) =>
                      updateWeight(
                        "buildingStockWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Poder de Compra no Orçamento</span>
                    <span className="font-mono text-primary">
                      {weights.budgetFitWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.budgetFitWeight}
                    onChange={(e) =>
                      updateWeight("budgetFitWeight", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-xs sm:col-span-2">
                  <div className="flex justify-between font-medium">
                    <span>Segurança Pública & Facilidade de Dirigir</span>
                    <span className="font-mono text-primary">
                      {weights.safetyCarWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.safetyCarWeight}
                    onChange={(e) =>
                      updateWeight("safetyCarWeight", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Compact Navigation & City Selector Toolbar */}
      <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:flex-wrap sm:gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("properties")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "properties"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="hidden sm:inline">Ranking de </span>Imóveis (
              {filteredProperties.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("neighborhoods")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "neighborhoods"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="hidden sm:inline">Ranking dos </span>20 Bairros
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "compare"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5 shrink-0" />
            <span>Comparador ({comparedProperties.length}/4)</span>
          </button>
        </div>

        {/* Inline City Pills with Muted Top-3 Badge + Opt-in BSB Benchmark Toggle */}
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:flex-wrap">
          {(
            [
              "ALL",
              "BH",
              "CP",
              "RJ",
              "SP",
              ...(enableBsbBenchmark ? (["BSB"] as const) : []),
            ] as const
          ).map((city) => {
            const cityInfo = city === "ALL" ? undefined : cityTop3ByCode.get(city);
            const isSelected =
              city === "ALL"
                ? selectedCities.length === 0
                : selectedCities.includes(city);
            return (
              <button
                key={city}
                type="button"
                aria-pressed={isSelected}
                title={
                  city === "ALL"
                    ? `${CITY_LABELS.ALL} (clique nas praças para selecionar mais de uma por vez)`
                    : city === "BSB"
                      ? "Águas Claras — Brasília (DF): Benchmark temporário para comparação com seu aluguel atual de R$ 3.400"
                      : `${CITY_LABELS[city]}${cityInfo ? ` — Top 3 bairros: ${cityInfo.top3Avg.toFixed(2)} (${cityInfo.top3Names.join(", ")})` : ""} · Clique para alternar seleção múltipla`
                }
                onClick={() => handleCitySelect(city)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5 ${
                  isSelected
                    ? city === "BSB"
                      ? "bg-amber-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : city === "BSB"
                      ? "border border-amber-500/50 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                      : "border bg-card hover:bg-secondary"
                }`}
              >
                <span>
                  {city === "ALL"
                    ? "Todas"
                    : city === "BSB"
                      ? "BSB (Ref)"
                      : city}
                </span>
                {cityInfo && (
                  <span
                    className={`font-mono text-[10px] font-normal ${
                      isSelected
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    · {cityInfo.top3Avg.toFixed(1)}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            data-testid="toggle-bsb-benchmark"
            aria-pressed={enableBsbBenchmark}
            onClick={handleToggleBsbBenchmark}
            title="Ativar/desativar comparação temporária com o mercado atual de Águas Claras (DF) vs. seu aluguel atual de R$ 3.400 (não altera o ranking fixo quando desativado)"
            className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-all sm:px-2.5 ${
              enableBsbBenchmark
                ? "border-amber-500 bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40 dark:border-amber-400 dark:bg-amber-500/25 dark:text-amber-100"
                : "border-dashed border-amber-500/50 bg-amber-500/5 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            <span aria-hidden="true">⚖️</span>
            <span className="sm:hidden">
              {enableBsbBenchmark ? "BSB Ativo" : "Benchmark BSB"}
            </span>
            <span className="hidden sm:inline">
              {enableBsbBenchmark
                ? "Benchmark: Águas Claras (Ativo)"
                : "Benchmark: Águas Claras (BSB)"}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROPERTIES EXPLORER */}
      {activeTab === "properties" && (
        <section className="space-y-3">
          {/* Collapsible BSB Benchmark Comparison Banner (Only visible when Benchmark Mode is toggled ON) */}
          {enableBsbBenchmark && (
            <div
              data-testid="bsb-benchmark-banner"
              className="rounded-xl border-2 border-amber-500/45 bg-gradient-to-br from-amber-500/10 via-card to-purple-500/5 p-3 sm:p-4 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:text-amber-100">
                      ⚖️ MODO BENCHMARK TEMPORÁRIO (OPT-IN)
                    </span>
                    <h2 className="text-xs sm:text-sm font-bold text-foreground">
                      Seu Aluguel Atual em Águas Claras (R$ 3.400/mês) vs.
                      Mercado Aberto Hoje ({bsbBenchmarkStats.totalScrapedBsb}{" "}
                      anúncios raspados em Águas Claras)
                    </h2>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    Comparação na mesma régua de pontuação (40–95 m², 1+ vaga,
                    modernidade e lazer). Quando desativado, Águas Claras sai
                    100% do ranking.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBenchmarkPanelCollapsed((v) => !v)}
                    className="rounded-md border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {benchmarkPanelCollapsed ? "Expandir dados" : "Recolher"}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBsbBenchmark}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-500/20 dark:text-rose-200"
                  >
                    <X className="h-3 w-3" />
                    <span>Desativar Benchmark</span>
                  </button>
                </div>
              </div>

              {!benchmarkPanelCollapsed && (
                <>
                  {/* Key Findings Grid: Why R$ 3.400 feels so different from open-market listings today */}
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                    <div className="rounded-lg border border-amber-500/30 bg-background/85 p-3 space-y-1">
                      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        1. Seu Contrato Vigente vs. Águas Claras Hoje
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-base font-bold text-foreground">
                          R$ 3.400
                        </span>
                        <span className="text-xs text-muted-foreground">
                          seu pacote hoje vs.{" "}
                          <strong className="font-mono text-amber-700 dark:text-amber-300">
                            R${" "}
                            {bsbBenchmarkStats.bsbModernMedianMonthly.toLocaleString(
                              "pt-BR",
                            )}
                          </strong>{" "}
                          (mediana moderna hoje em BSB)
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Para novos inquilinos entrando hoje em Águas Claras, o
                        pacote mediano de um apê moderno (48–75 m², 1+ vaga) já
                        subiu para{" "}
                        <strong>
                          R${" "}
                          {bsbBenchmarkStats.bsbModernMedianMonthly.toLocaleString(
                            "pt-BR",
                          )}
                          /mês
                        </strong>{" "}
                        (
                        {bsbBenchmarkStats.contractGapReais > 0
                          ? `+R$ ${bsbBenchmarkStats.contractGapReais.toLocaleString("pt-BR")}/mês ou +${bsbBenchmarkStats.contractGapPct}% acima do seu contrato`
                          : "em linha com seu contrato"}
                        ).
                      </p>
                    </div>

                    <div className="rounded-lg border bg-background/85 p-3 space-y-1">
                      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                        2. O Que R$ 3.400 Compra Hoje em Águas Claras?
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs">
                        <span>
                          ≤ R$ 3.400:{" "}
                          <strong className="text-sm text-foreground">
                            {bsbBenchmarkStats.countUpTo3400}
                          </strong>{" "}
                          apês ({bsbBenchmarkStats.countModernUpTo3400}{" "}
                          modernos)
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span>
                          ≤ R$ 4.000:{" "}
                          <strong className="text-sm text-foreground">
                            {bsbBenchmarkStats.countUpTo4000}
                          </strong>
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span>
                          ≤ R$ 4.500:{" "}
                          <strong className="text-sm text-foreground">
                            {bsbBenchmarkStats.countUpTo4500}
                          </strong>
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Dos {bsbBenchmarkStats.totalEligibleBsb} imóveis
                        qualificados hoje em Águas Claras, apenas{" "}
                        <strong>{bsbBenchmarkStats.countUpTo3400}</strong> saem
                        até R$ 3.400 (quase todos de 1 quarto/43–50 m²). Os
                        condomínios clube de 2 quartos (55–70 m²) hoje pedem{" "}
                        <strong>R$ 3.900 a R$ 4.900/mês</strong> em novos
                        anúncios.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-background/85 p-3 space-y-1.5">
                      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        3. Comparativo Direto (Mesmo Padrão Residencial: Sem
                        Mobília · 48–75 m²)
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        {bsbBenchmarkStats.cityComparisons.map((c) => (
                          <div
                            key={c.code}
                            className={`flex items-center justify-between rounded px-1.5 py-0.5 ${
                              c.code === "BSB"
                                ? "bg-amber-500/15 font-bold text-amber-900 dark:text-amber-100"
                                : "bg-muted/50 text-foreground"
                            }`}
                          >
                            <span className="font-sans text-[11px] font-semibold">
                              {c.label}
                            </span>
                            <span>
                              R$ {c.medianMonthly.toLocaleString("pt-BR")} · R${" "}
                              {c.medianPm2}/m² · {c.medianScore.toFixed(1)} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick 1-Click Benchmark Filter Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                      Testar na lista:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCities(["BSB"]);
                        setSelectedNeighborhoods([]);
                        setOnlyTop20Neighborhoods(false);
                        setMaxTotalMonthly(null);
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        selectedCities.length === 1 &&
                        selectedCities[0] === "BSB" &&
                        maxTotalMonthly === null
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "bg-background hover:bg-secondary"
                      }`}
                    >
                      Ver só Águas Claras ({bsbBenchmarkStats.totalEligibleBsb}{" "}
                      apês)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCities(["BSB"]);
                        setSelectedNeighborhoods([]);
                        setOnlyTop20Neighborhoods(false);
                        setMaxTotalMonthly(3600);
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        selectedCities.length === 1 &&
                        selectedCities[0] === "BSB" &&
                        maxTotalMonthly === 3600
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "bg-background hover:bg-secondary"
                      }`}
                    >
                      O que R$ 3.400–3.600 paga hoje em Águas Claras
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCities(["BSB", "BH"]);
                        setSelectedNeighborhoods([]);
                        setOnlyTop20Neighborhoods(true);
                        setMaxTotalMonthly(null);
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        selectedCities.length === 2 &&
                        selectedCities.includes("BSB") &&
                        selectedCities.includes("BH") &&
                        maxTotalMonthly === null
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-secondary"
                      }`}
                    >
                      Comparar Águas Claras + BH (Top Bairros)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCities(["BSB", "BH", "CP"]);
                        setSelectedNeighborhoods([]);
                        setOnlyTop20Neighborhoods(true);
                        setMaxTotalMonthly(4200);
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        selectedCities.length === 3 &&
                        selectedCities.includes("BSB") &&
                        maxTotalMonthly === 4200
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-secondary"
                      }`}
                    >
                      Até R$ 4.200: Águas Claras vs. BH vs. Campinas
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2-Level Ergonomic Filter System */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs space-y-2.5 sm:space-y-3">
            {/* LEVEL 1 — Primary Filter Strip (Always Visible) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Praça Quick Selector (Multi-Select — hidden on small screens since the top toolbar already shows city pills) */}
              <div className="hidden md:inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5 sm:order-1">
                {(
                  [
                    "ALL",
                    "BH",
                    "CP",
                    "RJ",
                    "SP",
                    ...(enableBsbBenchmark ? (["BSB"] as const) : []),
                  ] as const
                ).map((city) => {
                  const isSelected =
                    city === "ALL"
                      ? selectedCities.length === 0
                      : selectedCities.includes(city);
                  return (
                    <button
                      key={`l1-city-${city}`}
                      type="button"
                      aria-pressed={isSelected}
                      title={
                        city === "ALL"
                          ? "Mostrar todas as 4 praças"
                          : `Alternar ${CITY_LABELS[city]} (permite selecionar mais de uma praça)`
                      }
                      onClick={() => handleCitySelect(city)}
                      className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {city === "ALL" ? "Todas" : city}
                    </button>
                  );
                })}
              </div>

              {/* Free Search (Full-width Row 1 on mobile, flex-1 inline on sm+) */}
              <div className="relative order-1 w-full sm:order-3 sm:flex-1 sm:min-w-[200px]">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(30);
                  }}
                  placeholder="Rua, bairro, condomínio, comodidade, ID..."
                  className="w-full rounded-lg border bg-background pl-8 pr-7 py-1.5 sm:py-1 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mais Filtros Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                aria-expanded={showAdvancedFilters}
                className={`order-2 sm:order-6 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${
                  showAdvancedFilters || activeAdvancedFilterCount > 0
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="lg:hidden">Filtros</span>
                <span className="hidden lg:inline">Mais Filtros</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                    {activeAdvancedFilterCount}
                  </span>
                )}
                {showAdvancedFilters ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>

              {/* 1-Click Favoritos Filter Toggle */}
              <button
                type="button"
                onClick={() => {
                  setOnlyFavorites((v) => !v);
                  setVisibleCount(30);
                }}
                aria-pressed={onlyFavorites}
                title="Mostrar apenas seus imóveis favoritados (inclusive os que foram alugados/desativados)"
                className={`order-3 sm:order-2 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${
                  onlyFavorites
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                    : "bg-background text-foreground hover:bg-secondary"
                }`}
              >
                <Heart
                  className={`h-3.5 w-3.5 shrink-0 ${
                    onlyFavorites || favoriteKeys.length > 0
                      ? "fill-rose-500 text-rose-500"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="hidden sm:inline">Favoritos </span>
                <span>({favoriteKeys.length})</span>
              </button>

              {/* 1-Click Top 20 Bairros Strict Filter Toggle */}
              <button
                type="button"
                onClick={() => {
                  setOnlyTop20Neighborhoods((v) => !v);
                  setVisibleCount(30);
                }}
                aria-pressed={onlyTop20Neighborhoods}
                title="Apenas estritamente nos 20 Bairros do Ranking (Top 20) — exclui Savassi, Cambuí, Pinheiros, Catete, Copacabana, Barra Olímpica, etc."
                className={`order-3 sm:order-2 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs transition-colors sm:gap-1.5 sm:px-2.5 ${
                  onlyTop20Neighborhoods
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "bg-background font-semibold text-foreground hover:bg-secondary"
                }`}
              >
                <MapPin
                  className={`h-3.5 w-3.5 shrink-0 ${
                    onlyTop20Neighborhoods
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <span>Top 20 Bairros</span>
              </button>

              {/* Sort By Selector */}
              <div className="relative order-4 sm:order-4 inline-flex min-w-0 flex-1 sm:flex-initial items-center gap-1 rounded-lg border bg-background px-1.5 py-1 text-xs sm:gap-1.5 sm:px-2.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground hidden sm:inline">
                  Ordenar:
                </span>
                <span className="truncate font-semibold sm:hidden">
                  {SORT_BY_OPTIONS.find((o) => o.value === sortBy)
                    ?.shortLabel ?? "Nota ↓"}
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortByOption)}
                  aria-label="Ordenar imóveis"
                  className="absolute inset-0 w-full cursor-pointer opacity-0 sm:static sm:w-auto sm:opacity-100 bg-transparent font-semibold focus:outline-hidden"
                >
                  {SORT_BY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle: On mobile (< md), compact Lista vs Mapa; on md+, Lista + Mapa (Split) | Só Lista | Só Mapa */}
              <div
                role="group"
                aria-label="Modo de visualização"
                className="order-5 sm:order-5 inline-flex shrink-0 items-center rounded-lg border bg-background p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  title="Lista + Mapa lado a lado (Top 30)"
                  className={`hidden md:inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    viewMode === "split"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span>Lista + Mapa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="Exibir somente a lista de cards"
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 md:px-2 md:py-1 text-xs font-semibold transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="md:hidden">Lista</span>
                  <span className="hidden md:inline">Só Lista</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  title="Expandir o mapa interativo"
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 md:px-2 md:py-1 text-xs font-semibold transition-colors ${
                    viewMode === "map"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  <span className="md:hidden">Mapa</span>
                  <span className="hidden md:inline">Só Mapa</span>
                </button>
              </div>
            </div>

            {/* LEVEL 1B — Instant Quick Strips: Destaques & Comodidades · Valor Total (R$) · Área Útil (m²) · Tempo até o Escritório (min) (hidden by default on mobile until uncollapsed) */}
            <div
              className={`${
                showAdvancedFilters ? "grid" : "hidden lg:grid"
              } grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-4`}
            >
              {/* 1. Destaques & Comodidades Quick Filter */}
              <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Destaques & Comodidades
                  </span>
                  {requiredFeatures.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRequiredFeatures([]);
                        setVisibleCount(30);
                      }}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      Limpar ({requiredFeatures.length})
                    </button>
                  ) : (
                    <span className="font-mono font-semibold text-primary">
                      Qualquer
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {PROPERTY_FEATURE_OPTIONS.map((feat) => {
                    const active = requiredFeatures.includes(feat.key);
                    return (
                      <button
                        key={feat.key}
                        type="button"
                        onClick={() => {
                          setRequiredFeatures((prev) =>
                            prev.includes(feat.key)
                              ? prev.filter((f) => f !== feat.key)
                              : [...prev, feat.key],
                          );
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {feat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Pacote Mensal (Valor Total R$) Quick Filter + Slider */}
              <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Valor Total Mensal (R$)
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {maxTotalMonthly === null && minTotalMonthly === null
                      ? "Qualquer valor"
                      : minTotalMonthly !== null && maxTotalMonthly !== null
                        ? `R$ ${minTotalMonthly.toLocaleString("pt-BR")}–${maxTotalMonthly.toLocaleString("pt-BR")}`
                        : maxTotalMonthly !== null
                          ? `≤ R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
                          : `≥ R$ ${(minTotalMonthly ?? 0).toLocaleString("pt-BR")}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Qualquer", max: null },
                    { label: "≤ 4.000", max: 4000 },
                    { label: "≤ 4.500", max: 4500 },
                    { label: "≤ 5.500 (Ideal)", max: 5500 },
                    { label: "≤ 6.500 (Teto)", max: 6500 },
                  ].map((preset) => {
                    const active =
                      maxTotalMonthly === preset.max &&
                      (preset.max !== null || minTotalMonthly === null);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (preset.max === null) {
                            setMinTotalMonthly(null);
                            setMaxTotalMonthly(null);
                          } else {
                            setMaxTotalMonthly(preset.max);
                          }
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={1500}
                    max={8000}
                    step={100}
                    aria-label="Teto máximo de valor mensal"
                    value={maxTotalMonthly ?? 8000}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxTotalMonthly(val >= 8000 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <input
                      type="number"
                      min={1000}
                      max={15000}
                      step={100}
                      placeholder="Mín"
                      aria-label="Valor mensal mínimo"
                      value={minTotalMonthly ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMinTotalMonthly(raw === "" ? null : Number(raw));
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="number"
                      min={1500}
                      max={15000}
                      step={100}
                      placeholder="Máx"
                      aria-label="Valor mensal máximo"
                      value={maxTotalMonthly ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMaxTotalMonthly(raw === "" ? null : Number(raw));
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Área Útil (m²) Quick Filter + Inputs */}
              <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Área Útil (m²)
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {minAreaM2 === null && maxAreaM2 === null
                      ? "Qualquer área"
                      : `${minAreaM2 ?? 0}–${maxAreaM2 ?? "∞"} m²`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Qualquer", min: null, max: null },
                    { label: "≥ 45 m²", min: 45, max: null },
                    { label: "48–68 m² (Ideal)", min: 48, max: 68 },
                    { label: "≥ 60 m²", min: 60, max: null },
                    { label: "≥ 75 m²", min: 75, max: null },
                  ].map((preset) => {
                    const active =
                      minAreaM2 === preset.min && maxAreaM2 === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinAreaM2(preset.min);
                          setMaxAreaM2(preset.max);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={2}
                    aria-label="Área útil mínima"
                    value={minAreaM2 ?? 20}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinAreaM2(val <= 20 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <input
                      type="number"
                      min={15}
                      max={300}
                      placeholder="Mín m²"
                      aria-label="Área útil mínima em m²"
                      value={minAreaM2 ?? ""}
                      onChange={(e) => {
                        setMinAreaM2(
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        );
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="number"
                      min={20}
                      max={400}
                      placeholder="Máx m²"
                      aria-label="Área útil máxima em m²"
                      value={maxAreaM2 ?? ""}
                      onChange={(e) => {
                        setMaxAreaM2(
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        );
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Tempo até o Escritório (min) Quick Filter + Slider */}
              <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Tempo até o Escritório (min)
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {maxCommuteMinutes === null
                      ? "Qualquer"
                      : `≤ ${maxCommuteMinutes} min`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Qualquer", max: null },
                    { label: "≤ 10 min", max: 10 },
                    { label: "≤ 15 min", max: 15 },
                    { label: "≤ 20 min", max: 20 },
                    { label: "≤ 30 min", max: 30 },
                    { label: "≤ 40 min", max: 40 },
                  ].map((preset) => {
                    const active = maxCommuteMinutes === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMaxCommuteMinutes(preset.max);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    aria-label="Tempo máximo até o escritório em minutos"
                    value={maxCommuteMinutes ?? 60}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxCommuteMinutes(val >= 60 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="text-muted-foreground">≤</span>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      step={5}
                      placeholder="min"
                      aria-label="Tempo máximo em minutos"
                      value={maxCommuteMinutes ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMaxCommuteMinutes(raw === "" ? null : Number(raw));
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                    <span className="text-muted-foreground">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LEVEL 2 — Comprehensive Filter Grid ("Basicamente de tudo") */}
            {showAdvancedFilters && (
              <div className="border-t pt-3 space-y-3">
                {/* Row A: Neighborhoods Multi-Select (Sorted by Rank/Score with Counts) */}
                <div className="rounded-lg border bg-background/40 p-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-foreground">
                        Bairros ({availableNeighborhoodOptions.length}{" "}
                        disponíveis)
                      </span>
                      <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:bg-secondary">
                        <input
                          type="checkbox"
                          checked={onlyTop20Neighborhoods}
                          onChange={(e) => {
                            setOnlyTop20Neighborhoods(e.target.checked);
                            setVisibleCount(30);
                          }}
                          className="accent-primary"
                        />
                        <span>
                          Apenas estritamente nos 20 Bairros do Ranking (Top 20)
                        </span>
                      </label>
                    </div>
                    {selectedNeighborhoods.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedNeighborhoods([])}
                        className="text-primary hover:underline font-semibold"
                      >
                        Todos os bairros ({selectedNeighborhoods.length}{" "}
                        selecionado(s))
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNeighborhoods([]);
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        selectedNeighborhoods.length === 0
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Todos
                    </button>
                    {availableNeighborhoodOptions.map((nb) => {
                      const isSelected = selectedNeighborhoods.includes(
                        nb.name,
                      );
                      return (
                        <button
                          key={`${nb.cityCode}-${nb.name}`}
                          type="button"
                          onClick={() => {
                            setSelectedNeighborhoods((prev) =>
                              prev.includes(nb.name)
                                ? prev.filter((item) => item !== nb.name)
                                : [...prev, nb.name],
                            );
                            setVisibleCount(30);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-secondary"
                          }`}
                        >
                          {selectedCities.length !== 1 && (
                            <span className="font-mono text-[10px] opacity-75">
                              {nb.cityCode}
                            </span>
                          )}
                          <span>{nb.name}</span>
                          <span
                            className={`font-mono text-[10px] ${
                              isSelected
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            }`}
                          >
                            ({nb.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row B: Andar/Cobertura, Rooms/Bathrooms/Parking, Modernity/Condition, Furniture & Platform */}
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                  {/* Andar / Cobertura */}
                  <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold uppercase tracking-wider">
                        Andar / Cobertura
                      </span>
                      <span className="font-mono text-primary font-semibold truncate max-w-[180px]" title={
                        floorFilters.length === 0
                          ? "Qualquer andar"
                          : floorFilters
                              .map(
                                (ff) =>
                                  FLOOR_FILTER_OPTIONS.find((o) => o.value === ff)
                                    ?.shortLabel ?? ff,
                              )
                              .join(" + ")
                      }>
                        {floorFilters.length === 0
                          ? "Qualquer andar"
                          : floorFilters.length === 1
                            ? (FLOOR_FILTER_OPTIONS.find(
                                (o) => o.value === floorFilters[0],
                              )?.label ?? "Qualquer andar")
                            : floorFilters
                                .map(
                                  (ff) =>
                                    FLOOR_FILTER_OPTIONS.find(
                                      (o) => o.value === ff,
                                    )?.shortLabel ?? ff,
                                )
                                .join(" + ")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {FLOOR_FILTER_OPTIONS.map((opt) => {
                        const active =
                          opt.value === "ALL"
                            ? floorFilters.length === 0
                            : floorFilters.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (opt.value === "ALL") {
                                setFloorFilters([]);
                              } else {
                                setFloorFilters((prev) =>
                                  prev.includes(opt.value)
                                    ? prev.filter((item) => item !== opt.value)
                                    : [...prev, opt.value],
                                );
                              }
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quartos, Banheiros & Vagas */}
                  <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider">
                        Quartos
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: "Qualquer", val: null },
                          { label: "1", val: 1 },
                          { label: "2", val: 2 },
                          { label: "3+", val: 3 },
                        ].map((opt) => {
                          const active =
                            opt.val === null
                              ? selectedBedrooms.length === 0
                              : selectedBedrooms.includes(opt.val);
                          return (
                            <button
                              key={`bed-${opt.label}`}
                              type="button"
                              onClick={() => {
                                setMinBedrooms(null);
                                if (opt.val === null) {
                                  setSelectedBedrooms([]);
                                } else {
                                  const v = opt.val;
                                  setSelectedBedrooms((prev) =>
                                    prev.includes(v)
                                      ? prev.filter((item) => item !== v)
                                      : [...prev, v].sort((a, b) => a - b),
                                  );
                                }
                                setVisibleCount(30);
                              }}
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider">
                          Banheiros
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "Qualquer", val: null },
                            { label: "1", val: 1 },
                            { label: "2", val: 2 },
                            { label: "3+", val: 3 },
                          ].map((opt) => {
                            const active =
                              opt.val === null
                                ? selectedBathrooms.length === 0
                                : selectedBathrooms.includes(opt.val);
                            return (
                              <button
                                key={`bath-${opt.label}`}
                                type="button"
                                onClick={() => {
                                  setMinBathrooms(null);
                                  if (opt.val === null) {
                                    setSelectedBathrooms([]);
                                  } else {
                                    const v = opt.val;
                                    setSelectedBathrooms((prev) =>
                                      prev.includes(v)
                                        ? prev.filter((item) => item !== v)
                                        : [...prev, v].sort((a, b) => a - b),
                                    );
                                  }
                                  setVisibleCount(30);
                                }}
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider">
                          Vagas
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "Qualquer", val: null },
                            { label: "1 vaga", val: 1 },
                            { label: "2+ vagas", val: 2 },
                          ].map((opt) => {
                            const active =
                              opt.val === null
                                ? selectedParking.length === 0
                                : selectedParking.includes(opt.val);
                            return (
                              <button
                                key={`park-${opt.label}`}
                                type="button"
                                onClick={() => {
                                  setMinParking(null);
                                  if (opt.val === null) {
                                    setSelectedParking([]);
                                  } else {
                                    const v = opt.val;
                                    setSelectedParking((prev) =>
                                      prev.includes(v)
                                        ? prev.filter((item) => item !== v)
                                        : [...prev, v].sort((a, b) => a - b),
                                    );
                                  }
                                  setVisibleCount(30);
                                }}
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estado de Conservação / Modernidade */}
                  <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold uppercase tracking-wider">
                        Conservação & Modernidade
                      </span>
                      <span className="font-mono text-primary font-semibold">
                        {minModernityScore === null
                          ? "Qualquer"
                          : `≥ ${minModernityScore}/100`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          {
                            tier: "MODERN_OR_RENOVATED",
                            label: "Novo / Reformado",
                          },
                          {
                            tier: "WELL_MAINTAINED",
                            label: "Bem Conservado",
                          },
                          {
                            tier: "STANDARD",
                            label: "Padrão",
                          },
                          {
                            tier: "DATED",
                            label: "Antigo / Datado",
                          },
                        ] as const
                      ).map((item) => {
                        const active = modernityTiers.includes(item.tier);
                        return (
                          <button
                            key={item.tier}
                            type="button"
                            onClick={() => {
                              setModernityTiers((prev) =>
                                prev.includes(item.tier)
                                  ? prev.filter((t) => t !== item.tier)
                                  : [...prev, item.tier],
                              );
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={2}
                        aria-label="Score mínimo de modernidade"
                        value={minModernityScore ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinModernityScore(val <= 0 ? null : val);
                          setVisibleCount(30);
                        }}
                        className="h-1.5 flex-1 accent-primary"
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Mín {minModernityScore ?? 0}/100
                      </span>
                    </div>
                  </div>

                  {/* Mobília & Plataforma */}
                  <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider">
                        Mobília
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { val: "ALL", label: "Todos" },
                            { val: "UNFURNISHED", label: "Sem mobília" },
                            {
                              val: "UNFURNISHED_OR_SEMI",
                              label: "Sem mobília ou Semi",
                            },
                            {
                              val: "SEMI_FURNISHED",
                              label: "Só Semi-mobiliado",
                            },
                            { val: "FURNISHED", label: "Mobiliado" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              setFurnishedFilter(opt.val);
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              furnishedFilter === opt.val
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider">
                        Plataforma
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { val: "ALL", label: "Todas" },
                            { val: "quintoandar", label: "QuintoAndar" },
                            { val: "zapimoveis", label: "Zap Imóveis" },
                            { val: "vivareal", label: "Viva Real" },
                            { val: "netimoveis", label: "Netimóveis" },
                            { val: "imovelweb", label: "Imovelweb" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              setProviderFilter(opt.val);
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              providerFilter === opt.val
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row C: Pontuação (Nota / Score) + Exclusões / Proteções Extras */}
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
                  {/* Pontuação (Nota / Score) */}
                  <div className="lg:col-span-2 rounded-lg border bg-background/40 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-foreground">
                        Pontuação (Nota / Score)
                      </span>
                      <span className="font-mono font-semibold text-primary">
                        {minScore === null ? "Qualquer nota" : `≥ ${minScore} pts`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "Qualquer", val: null },
                        { label: "≥ 85 pts", val: 85 },
                        { label: "≥ 80 pts", val: 80 },
                        { label: "≥ 75 pts", val: 75 },
                        { label: "≥ 70 pts", val: 70 },
                        { label: "≥ 65 pts", val: 65 },
                      ].map((preset) => {
                        const active = minScore === preset.val;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setMinScore(preset.val);
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        aria-label="Nota mínima do imóvel"
                        value={minScore ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinScore(val <= 0 ? null : val);
                          setVisibleCount(30);
                        }}
                        className="h-1.5 flex-1 accent-primary"
                      />
                      <span className="font-mono text-[10px] text-muted-foreground w-14 text-right">
                        {minScore === null ? "0–100" : `${minScore}/100`}
                      </span>
                    </div>
                  </div>

                  {/* Exclusões & Proteções Extras */}
                  <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider">
                      Exclusões & Opções Extras
                    </span>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-semibold text-muted-foreground">
                        Status do Anúncio{" "}
                        {deactivatedTotalCount > 0
                          ? `(${deactivatedTotalCount} desativados)`
                          : ""}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            {
                              val: "ACTIVE_ONLY",
                              label: "Só Ativos (Padrão)",
                            },
                            {
                              val: "ALL",
                              label: "Incluir Desativados / Alugados",
                            },
                            {
                              val: "DEACTIVATED_ONLY",
                              label: "Só Desativados",
                            },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              setDeactivatedFilter(opt.val);
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              deactivatedFilter === opt.val
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 text-xs pt-0.5">
                      <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyTop20Neighborhoods}
                          onChange={(e) => {
                            setOnlyTop20Neighborhoods(e.target.checked);
                            setVisibleCount(30);
                          }}
                          className="accent-primary"
                        />
                        <span>
                          Apenas estritamente nos 20 Bairros do Ranking (Top 20)
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hideMegaCondo}
                          onChange={(e) => {
                            setHideMegaCondo(e.target.checked);
                            setVisibleCount(30);
                          }}
                          className="accent-primary"
                        />
                        <span>Ocultar Megacondomínios</span>
                      </label>
                      <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyNewEntries}
                          onChange={(e) => {
                            setOnlyNewEntries(e.target.checked);
                            setVisibleCount(30);
                          }}
                          className="accent-primary"
                        />
                        <span>Só novas entradas</span>
                      </label>
                      <label className="inline-flex items-center gap-2 font-medium text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showIneligible}
                          onChange={(e) => {
                            setShowIneligible(e.target.checked);
                            setVisibleCount(30);
                          }}
                          className="accent-primary"
                        />
                        <span>
                          Incluir reprovados (sem elevador / vaga presa)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status & Active Filter Pills Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                  Exibindo{" "}
                  <strong className="text-foreground">
                    {filteredProperties.length}
                  </strong>{" "}
                  de{" "}
                  <strong className="text-foreground">
                    {totalBasePoolCount}
                  </strong>{" "}
                  imóveis
                </span>

                {activeFilterPills.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={pill.onClear}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
                  >
                    <span>{pill.label}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopyTop50ForAi()}
                  disabled={filteredProperties.length === 0}
                  title="Copiar resumo estruturado em Markdown do Top 50 exibido na tela (ou total filtrado) para enviar a outra IA"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    copiedTop50Count !== null
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-200"
                      : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {copiedTop50Count !== null ? (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Copiado ({copiedTop50Count} imóveis p/ IA)!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {filteredProperties.length > 0 &&
                        filteredProperties.length < 50
                          ? `Copiar Top 50 (${filteredProperties.length})`
                          : "Copiar Top 50"}
                      </span>
                    </>
                  )}
                </button>

                {activeFilterPills.length > 0 && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Properties Content: Split-Screen (Lista + Mapa), Só Lista, or Só Mapa */}
          {viewMode === "map" ? (
            <div className="space-y-3">
              <div className="h-[calc(100vh-8rem)] min-h-[600px] w-full">
                <PropertyMapView
                  properties={filteredProperties.slice(0, visibleCount)}
                  totalFilteredCount={filteredProperties.length}
                  onLoadMore={() => setVisibleCount((c) => c + 30)}
                  selectedCity={
                    selectedCities.length === 1 ? selectedCities[0]! : "ALL"
                  }
                  favoriteKeys={favoriteKeys}
                  hoveredPropertyKey={hoveredPropertyKey}
                  selectedPropertyKey={selectedMapPropertyKey}
                  onHoverProperty={setHoveredPropertyKey}
                  onSelectProperty={setSelectedMapPropertyKey}
                  onFocusCardInList={focusCardInList}
                  onToggleFavorite={toggleFavorite}
                  onOpenGallery={(property, initialIndex) =>
                    setGalleryState({ property, initialIndex })
                  }
                />
              </div>
              {visibleCount < filteredProperties.length && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + 30)}
                    className="rounded-lg border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary"
                  >
                    Carregar mais imóveis no mapa ({visibleCount} de{" "}
                    {filteredProperties.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div
            className={
              viewMode === "split"
                ? "grid grid-cols-1 gap-4 xl:grid-cols-12 items-start"
                : "space-y-3"
            }
          >
          {/* Properties List */}
          <div
            className={
              viewMode === "split"
                ? "xl:col-span-7 space-y-3 order-2 xl:order-1"
                : "space-y-3"
            }
          >
            {filteredProperties.length === 0 && (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2.5">
                <p className="text-sm font-semibold text-foreground">
                  Nenhum imóvel encontrado com a combinação atual de filtros.
                </p>
                <p className="text-xs text-muted-foreground">
                  Experimente relaxar o filtro de andar/cobertura, valor ou
                  comodidades cumulativas.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpar todos os filtros
                </button>
              </div>
            )}
            {filteredProperties.slice(0, visibleCount).map((prop) => {
              const key = `${prop.provider}:${prop.id}`;
              const safeCardDomId = `property-card-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
              const isExpanded = expandedId === key;
              const isMapHighlighted =
                hoveredPropertyKey === key || selectedMapPropertyKey === key;
              const inCompare = compareKeys.includes(key);
              const isFav = favoriteKeys.includes(key);
              const isDeactivated = prop.isActive === false;
              const fullPhotos =
                extraPhotosByKey[key] &&
                extraPhotosByKey[key]!.length > prop.samplePhotos.length
                  ? extraPhotosByKey[key]!
                  : prop.samplePhotos;
              const totalGalleryCount = Math.max(
                fullPhotos.length,
                prop.photosCount || fullPhotos.length,
              );
              const propWithPhotos: EvaluatedProperty =
                fullPhotos !== prop.samplePhotos
                  ? {
                      ...prop,
                      samplePhotos: fullPhotos,
                      photosCount: totalGalleryCount,
                    }
                  : prop;
              const tierBadge =
                MODERNITY_TIER_BADGES[prop.modernityTier] ??
                MODERNITY_TIER_BADGES.STANDARD!;
              const providerStyle = getProviderStyle(prop.provider);

              return (
                <article
                  key={key}
                  id={safeCardDomId}
                  onMouseEnter={() => setHoveredPropertyKey(key)}
                  onMouseLeave={() =>
                    setHoveredPropertyKey((prev) => (prev === key ? null : prev))
                  }
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  className={`cursor-pointer rounded-xl border bg-card transition-all hover:border-primary/40 ${
                    isMapHighlighted
                      ? "border-primary ring-2 ring-primary/35 shadow-md"
                      : isDeactivated
                        ? "opacity-75 border-rose-500/35"
                        : !prop.eligible
                          ? "opacity-65 border-dashed"
                          : "shadow-2xs"
                  }`}
                >
                  <div className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:flex-row md:items-start">
                    {/* Prominent Photo Showcase (Bento Mosaic / Split / Cover + Lightbox Trigger) */}
                    <PropertyCardPhotoShowcase
                      property={propWithPhotos}
                      compact={viewMode === "split"}
                      isFavorite={isFav}
                      onToggleFavorite={() => toggleFavorite(key)}
                      onOpenGallery={(initialIndex) =>
                        setGalleryState({
                          property: propWithPhotos,
                          initialIndex,
                        })
                      }
                    />

                    {/* Main Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                              CITY_BADGE_INFO[prop.cityCode].className
                            }`}
                          >
                            {CITY_BADGE_INFO[prop.cityCode].ufLabel}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            #{prop.cityRank ?? "—"} em {prop.cityCode}
                            {prop.commuteLabel
                              ? ` · ${prop.commuteLabel} do Nu`
                              : prop.commuteMinutes !== undefined
                                ? ` · ${prop.commuteMinutes} min do Nu`
                                : ""}
                          </span>
                          {isDeactivated && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[11px] sm:px-2.5 sm:text-xs font-bold text-rose-800 dark:text-rose-200">
                              <span>Desativado / Alugado</span>
                              {prop.deactivatedAt && (
                                <span className="font-mono text-[10px] font-normal opacity-90">
                                  (
                                  {new Date(
                                    prop.deactivatedAt,
                                  ).toLocaleDateString("pt-BR")}
                                  )
                                </span>
                              )}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md border px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-medium ${tierBadge.className}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`text-[10px] leading-none ${tierBadge.dotClassName}`}
                            >
                              ●
                            </span>
                            <span className="sm:hidden">
                              {tierBadge.shortLabel}
                            </span>
                            <span className="hidden sm:inline">
                              {tierBadge.label}
                            </span>
                            <span className="font-mono text-[10px] sm:text-[11px] text-muted-foreground">
                              <span className="sm:hidden">
                                ({prop.modernityScore})
                              </span>
                              <span className="hidden sm:inline">
                                ({prop.modernityScore}/100)
                              </span>
                            </span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(key);
                          }}
                          aria-label={
                            isFav
                              ? "Remover dos favoritos"
                              : "Adicionar aos favoritos"
                          }
                          title={
                            isFav
                              ? "Remover dos favoritos"
                              : "Salvar nos favoritos"
                          }
                          className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${
                            isFav
                              ? "border-rose-500/40 bg-rose-500/12 text-rose-600 dark:text-rose-300"
                              : "bg-background text-muted-foreground hover:bg-secondary hover:text-rose-500"
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${
                              isFav ? "fill-rose-500 text-rose-500" : ""
                            }`}
                          />
                          <span>{isFav ? "Favorito" : "Favoritar"}</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3 sm:gap-y-1.5">
                        <div className="min-w-0 sm:min-w-[180px] sm:flex-1">
                          <h3 className="text-sm sm:text-base font-bold leading-snug">
                            {prop.neighborhood} — {prop.street}
                            {prop.streetNumber ? `, ${prop.streetNumber}` : ""}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {prop.condominiumName ? (
                              <>
                                <span className="sm:hidden">
                                  {prop.condominiumName} ·{" "}
                                </span>
                                <span className="hidden sm:inline">
                                  Condomínio {prop.condominiumName} ·{" "}
                                </span>
                              </>
                            ) : null}
                            {prop.areaM2} m² ·{" "}
                            <span className="sm:hidden">
                              {prop.bedrooms}q
                              {prop.suites > 0 ? ` (${prop.suites}s)` : ""} ·{" "}
                              {prop.bathrooms}b · {prop.parkingSpaces}v · Mob:{" "}
                              {prop.furnitureTier === "FULLY_FURNISHED"
                                ? "Sim"
                                : prop.furnitureTier === "SEMI_FURNISHED"
                                  ? "Semi"
                                  : "Não"}
                            </span>
                            <span className="hidden sm:inline">
                              {prop.bedrooms} quarto(s)
                              {prop.suites > 0
                                ? ` (${prop.suites} suíte)`
                                : ""}{" "}
                              · {prop.bathrooms} banheiro(s) ·{" "}
                              {prop.parkingSpaces} vaga(s) · Mobiliado:{" "}
                              {prop.furnitureTier === "FULLY_FURNISHED"
                                ? "Sim"
                                : prop.furnitureTier === "SEMI_FURNISHED"
                                  ? "Semi (Eletros)"
                                  : "Não"}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 sm:block sm:max-w-full sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:justify-end">
                            <span className="font-mono text-base sm:text-lg font-bold text-primary">
                              {prop.finalScore.toFixed(1)} pts
                            </span>
                            <span className="font-mono text-sm sm:text-base font-bold">
                              R$ {prop.totalMonthly.toLocaleString("pt-BR")}/mês
                            </span>
                          </div>
                          <p className="w-full sm:w-auto text-[10.5px] sm:text-[11px] text-muted-foreground font-mono">
                            Alug R$ {prop.rent.toLocaleString("pt-BR")} + Cond
                            R$ {prop.condoFee.toLocaleString("pt-BR")} + IPTU R${" "}
                            {prop.iptu.toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      {/* Focused Key Tags: Fortnite Floor Rarity Badge + Green & Red Pills */}
                      {(prop.cardTags.floorTag !== null ||
                        prop.cardTags.greenTags.length > 0 ||
                        prop.cardTags.redTags.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs font-semibold">
                          {prop.cardTags.floorTag && (
                            <span
                              className={`rounded-md border px-2.5 py-0.5 ${
                                FLOOR_RARITY_BADGES[
                                  prop.cardTags.floorTag.rarity
                                ].className
                              }`}
                            >
                              {prop.cardTags.floorTag.label}
                            </span>
                          )}
                          {prop.cardTags.greenTags.map((tag) => (
                            <span
                              key={`green-${tag}`}
                              className="rounded-md border border-emerald-600/30 bg-emerald-500/12 px-2.5 py-0.5 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                            >
                              {tag}
                            </span>
                          ))}
                          {prop.cardTags.redTags.map((tag) => (
                            <span
                              key={`red-${tag}`}
                              className="rounded-md border border-rose-600/30 bg-rose-500/12 px-2.5 py-0.5 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Complementary Non-Redundant Highlights (Prós & Ressalvas) — collapsed when map is open unless card is expanded */}
                      {(viewMode === "list" || isExpanded) &&
                        (() => {
                          const text = prop.shortJustification.trim();
                          let prosText = text;
                          let consText = "";

                          if (text.includes("\n")) {
                            const [firstLine, ...restLines] = text.split("\n");
                            prosText = (firstLine ?? "").trim();
                            consText = restLines
                              .join(" ")
                              .trim()
                              .replace(/^(?:Por outro lado|Em contrapartida),\s*/i, "");
                          } else {
                            const legacyIdx = text.search(
                              /\s+(?:Por outro lado|Em contrapartida),/,
                            );
                            if (legacyIdx !== -1) {
                              prosText = text.slice(0, legacyIdx).trim();
                              consText = text
                                .slice(legacyIdx)
                                .trim()
                                .replace(/^(?:Por outro lado|Em contrapartida),\s*/i, "");
                            } else {
                              // Find sentence boundary after the em-dash (—) so abbreviations like "próx." never split the sentence
                              const dashPos = text.indexOf("—");
                              const dotAfterDash =
                                dashPos !== -1 ? text.indexOf(". ", dashPos) : -1;
                              if (dotAfterDash !== -1) {
                                prosText = text.slice(0, dotAfterDash + 1).trim();
                                consText = text.slice(dotAfterDash + 2).trim();
                              }
                            }
                          }

                          if (consText) {
                            consText =
                              consText.charAt(0).toUpperCase() + consText.slice(1);
                          }

                          if (!consText) {
                            return (
                              <p className="text-xs leading-relaxed text-muted-foreground pt-0.5">
                                {prosText}
                              </p>
                            );
                          }

                          return (
                            <div className="space-y-1 pt-0.5 text-xs leading-relaxed">
                              <p className="text-muted-foreground">
                                <span className="mr-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                  Prós:
                                </span>
                                {prosText}
                              </p>
                              <p className="text-muted-foreground">
                                <span className="mr-1.5 font-semibold text-rose-700 dark:text-rose-400">
                                  Ressalvas:
                                </span>
                                {consText}
                              </p>
                            </div>
                          );
                        })()}

                      {/* Action Row */}
                      <div className="flex flex-col gap-1.5 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(key);
                            }}
                            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                              inCompare
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-secondary"
                            }`}
                          >
                            <GitCompare className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {inCompare ? "Comparando" : "Comparar"}
                            </span>
                          </button>
                          {fullPhotos.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryState({
                                  property: propWithPhotos,
                                  initialIndex: 0,
                                });
                              }}
                              className="hidden sm:inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                            >
                              <Images className="h-3.5 w-3.5 text-primary" />
                              Galeria ({totalGalleryCount})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (viewMode === "list") {
                                setViewMode("split");
                              }
                              setSelectedMapPropertyKey(key);
                            }}
                            title="Localizar e destacar este imóvel no mapa interativo"
                            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                              selectedMapPropertyKey === key
                                ? "border-primary bg-primary/15 text-primary font-semibold"
                                : "bg-background hover:bg-secondary"
                            }`}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>Mapa</span>
                          </button>
                          {(() => {
                            const cardQaList =
                              qaItemsByPropertyKey.get(key) ?? [];
                            const isPinnedInChat =
                              showChatDrawer && pinnedChatPropertyKey === key;
                            const hasPending = cardQaList.some(
                              (q) => q.status === "pending",
                            );
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openChatForProperty(
                                    key,
                                    cardQaList.length > 0,
                                  );
                                }}
                                title="Fixar este imóvel no Chat & Consultor da Sessão"
                                className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5 ${
                                  isPinnedInChat || cardQaList.length > 0
                                    ? "border-purple-500/40 bg-purple-500/12 text-purple-800 dark:border-purple-400/40 dark:bg-purple-500/20 dark:text-purple-200"
                                    : "bg-background hover:bg-secondary"
                                }`}
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                                <span className="truncate">Perguntar</span>
                                {hasPending && (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-purple-500 animate-pulse" />
                                )}
                              </button>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2">
                          <a
                            href={prop.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 sm:px-3 sm:py-1 text-xs font-semibold transition-colors ${providerStyle.cardClassName}`}
                          >
                            <span className="truncate">
                              Abrir no {providerStyle.label}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : key);
                            }}
                            className="inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 py-1.5 sm:py-1 text-xs font-semibold hover:bg-secondary"
                          >
                            {isExpanded ? (
                              <>
                                <span>Menos</span>
                                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                              </>
                            ) : (
                              <>
                                <span className="sm:hidden">Detalhes</span>
                                <span className="hidden sm:inline">
                                  Detalhes & Fotos
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Compact Chat Thread Badge on Card */}
                      {(() => {
                        const cardQaList =
                          qaItemsByPropertyKey.get(key) ?? [];
                        if (cardQaList.length === 0) return null;
                        const lastQa = cardQaList.at(-1);

                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-purple-500/30 bg-purple-500/8 px-2.5 py-1.5 text-xs dark:border-purple-400/25 dark:bg-purple-950/25"
                          >
                            <button
                              type="button"
                              onClick={() => openChatForProperty(key, true)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-purple-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-2xs hover:bg-purple-700">
                                💬 Ver {cardQaList.length} msg no Chat
                              </span>
                              {lastQa && (
                                <span className="truncate text-[11px] text-muted-foreground">
                                  <strong className="text-foreground">
                                    {lastQa.question}
                                  </strong>
                                  {lastQa.answer
                                    ? ` — ${lastQa.answer.replace(/\*\*/g, "").slice(0, 90)}...`
                                    : " (Analisando...)"}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Expanded Drawer: Score Breakdown + Detailed Justification + Photo Gallery */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-default border-t bg-muted/30 p-4 space-y-4"
                    >
                      <div className="rounded-lg border bg-card p-3.5 space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Análise & Trade-offs da Escolha
                        </h4>
                        <p className="text-xs leading-relaxed text-foreground">
                          {prop.narrativeJustification}
                        </p>
                        <details className="group rounded-lg border bg-background/60 p-3 text-xs">
                          <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                            Ver memória de cálculo e notas quebradas
                          </summary>
                          <div className="mt-2.5 space-y-2">
                            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Bairro: +{prop.breakdown.neighborhoodPoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Modernidade: +{prop.breakdown.modernityPoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Nuances:{" "}
                                {prop.breakdown.nuancesPoints >= 0
                                  ? `+${prop.breakdown.nuancesPoints}`
                                  : prop.breakdown.nuancesPoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Orçamento:{" "}
                                {prop.breakdown.budgetPoints >= 0
                                  ? `+${prop.breakdown.budgetPoints}`
                                  : prop.breakdown.budgetPoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Mobília:{" "}
                                {prop.breakdown.furniturePoints >= 0
                                  ? `+${prop.breakdown.furniturePoints}`
                                  : prop.breakdown.furniturePoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Planta:{" "}
                                {prop.breakdown.areaPoints >= 0
                                  ? `+${prop.breakdown.areaPoints}`
                                  : prop.breakdown.areaPoints}
                              </span>
                              <span className="rounded bg-secondary px-2 py-0.5">
                                Garagem:{" "}
                                {prop.breakdown.parkingPoints >= 0
                                  ? `+${prop.breakdown.parkingPoints}`
                                  : prop.breakdown.parkingPoints}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {prop.detailedJustification}
                            </p>
                          </div>
                        </details>
                      </div>

                      {fullPhotos.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Fotos Internas Raspadas ({fullPhotos.length}{" "}
                              {fullPhotos.length === 1 ? "foto" : "fotos"}
                              {totalGalleryCount > fullPhotos.length
                                ? ` · de ${totalGalleryCount} no anúncio`
                                : ""}
                              )
                            </h4>
                            <button
                              type="button"
                              onClick={() =>
                                setGalleryState({
                                  property: propWithPhotos,
                                  initialIndex: 0,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-semibold text-primary hover:bg-secondary"
                            >
                              <Images className="h-3.5 w-3.5" />
                              Abrir Galeria em Tela Cheia ({totalGalleryCount})
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                            {fullPhotos.map((ph, idx) => (
                              <button
                                key={`${ph.url}-${idx}`}
                                type="button"
                                onClick={() =>
                                  setGalleryState({
                                    property: propWithPhotos,
                                    initialIndex: idx,
                                  })
                                }
                                className="group relative block h-44 w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left"
                              >
                                <img
                                  src={getCardPhotoUrl(ph.url)}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => handleImgError(e, ph.url)}
                                  alt={ph.room ?? `Foto ${idx + 1}`}
                                  loading="lazy"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                                <span className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                                  {ph.room ?? `Foto ${idx + 1}`}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {(prop.description || prop.generatedDescription) && (
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {prop.description
                              ? "Descrição Original do Anúncio"
                              : "Descrição do Imóvel"}
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                            {prop.description ?? prop.generatedDescription}
                          </p>
                        </div>
                      )}

                      {/* Rich Nuances Metadata Grid (Deduplicated & Normalized) */}
                      {(() => {
                        const { interiorFeatures, condoFeatures } =
                          categorizePropertyFeatures(prop);
                        return (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                            {interiorFeatures.length > 0 && (
                              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                                <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                  Conforto, Luz & Praticidade
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {interiorFeatures.map((item) => (
                                    <span
                                      key={item}
                                      className="rounded bg-secondary px-2 py-0.5 text-[11px]"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {condoFeatures.length > 0 && (
                              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                                <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                  Condomínio & Instalações
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {condoFeatures.map((item) => (
                                    <span
                                      key={item}
                                      className="rounded bg-secondary px-2 py-0.5 text-[11px]"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {prop.placesNearby.length > 0 && (
                              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                                <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                  Pontos Próximos ({prop.placesNearby.length})
                                </h5>
                                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                                  {prop.placesNearby.map((pl, idx) => (
                                    <span
                                      key={`${pl.name}-${idx}`}
                                      className={`rounded px-2 py-0.5 text-[11px] ${
                                        pl.type === "PARK_OR_GREEN_AREA"
                                          ? "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 font-medium"
                                          : pl.type === "SHOPPING_MALL" ||
                                              pl.type ===
                                                "ESTACAO_METRO_OU_TREM"
                                            ? "bg-primary/15 text-primary font-medium"
                                            : "bg-secondary text-muted-foreground"
                                      }`}
                                    >
                                      {pl.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </article>
              );
            })}

            {visibleCount < filteredProperties.length && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + 30)}
                  className="rounded-lg border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary"
                >
                  Carregar mais imóveis ({visibleCount} de{" "}
                  {filteredProperties.length})
                </button>
              </div>
            )}
          </div>

          {viewMode === "split" && (
            <div className="xl:col-span-5 xl:sticky xl:top-3 h-[360px] sm:h-[420px] xl:h-[calc(100vh-1.5rem)] order-1 xl:order-2">
              <PropertyMapView
                properties={filteredProperties.slice(0, visibleCount)}
                selectedCity={
                  selectedCities.length === 1 ? selectedCities[0]! : "ALL"
                }
                favoriteKeys={favoriteKeys}
                hoveredPropertyKey={hoveredPropertyKey}
                selectedPropertyKey={selectedMapPropertyKey}
                onHoverProperty={setHoveredPropertyKey}
                onSelectProperty={setSelectedMapPropertyKey}
                onFocusCardInList={focusCardInList}
                onToggleFavorite={toggleFavorite}
                onOpenGallery={(property, initialIndex) =>
                  setGalleryState({ property, initialIndex })
                }
              />
            </div>
          )}
          </div>
          )}
        </section>
      )}

      {/* TAB 2: DYNAMIC 20 NEIGHBORHOODS */}
      {activeTab === "neighborhoods" && (
        <section className="space-y-4">
          {/* Mobile / Compact Neighborhood Cards (< md) */}
          <div className="space-y-3 md:hidden">
            {dynamicNeighborhoods
              .filter(
                (n) =>
                  selectedCities.length === 0 ||
                  selectedCities.includes(n.cityCode),
              )
              .map((n) => {
                const rankDiff = n.overallPosition - n.dynamicOverallRank;
                return (
                  <article
                    key={`mob-${n.cityCode}:${n.neighborhood}`}
                    className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold">
                          #{n.dynamicOverallRank}
                          {rankDiff !== 0 && (
                            <span
                              className={`ml-1 text-[10px] ${
                                rankDiff > 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                            </span>
                          )}
                        </span>
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                            CITY_BADGE_INFO[n.cityCode].className
                          }`}
                        >
                          {CITY_BADGE_INFO[n.cityCode].ufLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCities([n.cityCode]);
                            setSelectedNeighborhoods([n.neighborhood]);
                            setActiveTab("properties");
                          }}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          {n.neighborhood}
                        </button>
                      </div>
                      <span className="font-mono text-base font-bold text-primary">
                        {n.dynamicScore.toFixed(2)}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-2 text-center font-mono text-[10px]">
                      <div>
                        <span className="block text-muted-foreground">Respiro</span>
                        <strong className="text-xs">{n.urbanBreathingScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Logíst.</span>
                        <strong className="text-xs">{n.commuteLogisticsScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Estoque</span>
                        <strong className="text-xs">{n.buildingStockFitScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Orçam.</span>
                        <strong className="text-xs">{n.budgetFitScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Segur.</span>
                        <strong className="text-xs">{n.safetyCarScore.toFixed(1)}</strong>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-foreground">
                      <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                        [{n.commuteTime}]
                      </span>
                      {n.shortRationale}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {n.detailedJustification.replace(
                        /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                        "",
                      )}
                    </p>
                  </article>
                );
              })}
          </div>

          {/* Desktop Full Table (>= md) */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Pos. Dinâmica</th>
                    <th className="px-3 py-3">Cidade</th>
                    <th className="px-3 py-3">Bairro</th>
                    <th className="px-3 py-3 text-right">Nota Dinâmica</th>
                    <th className="px-3 py-3 text-right">Respiro</th>
                    <th className="px-3 py-3 text-right">Logística</th>
                    <th className="px-3 py-3 text-right">Estoque</th>
                    <th className="px-3 py-3 text-right">Orçamento</th>
                    <th className="px-3 py-3 text-right">Carro/Seg.</th>
                    <th className="px-3 py-3">Tempo Nubank</th>
                    <th className="px-3 py-3">Justificativa Detalhada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dynamicNeighborhoods
                    .filter(
                      (n) =>
                        selectedCities.length === 0 ||
                        selectedCities.includes(n.cityCode),
                    )
                    .map((n) => {
                      const rankDiff = n.overallPosition - n.dynamicOverallRank;
                      return (
                        <tr
                          key={`${n.cityCode}:${n.neighborhood}`}
                          className="hover:bg-muted/30 align-top"
                        >
                          <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                            #{n.dynamicOverallRank}
                            {rankDiff !== 0 && (
                              <span
                                className={`ml-1.5 text-[10px] ${
                                  rankDiff > 0
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                                CITY_BADGE_INFO[n.cityCode].className
                              }`}
                            >
                              {CITY_BADGE_INFO[n.cityCode].ufLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCities([n.cityCode]);
                                setSelectedNeighborhoods([n.neighborhood]);
                                setActiveTab("properties");
                              }}
                              className="text-primary hover:underline"
                            >
                              {n.neighborhood}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">
                            {n.dynamicScore.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.urbanBreathingScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.commuteLogisticsScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.buildingStockFitScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.budgetFitScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.safetyCarScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono">
                            {n.commuteTime}
                          </td>
                          <td className="px-3 py-3 min-w-[340px] max-w-xl leading-relaxed text-muted-foreground space-y-1.5">
                            <p className="font-medium text-foreground">
                              {n.shortRationale}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {n.detailedJustification.replace(
                                /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                                "",
                              )}
                            </p>
                            <details className="group rounded-lg border bg-background/60 p-2.5 text-[11px]">
                              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                                Ver memória de cálculo e notas quebradas
                              </summary>
                              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                                {n.dynamicJustification}
                              </p>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: SIDE-BY-SIDE COMPARATOR */}
      {activeTab === "compare" && (
        <section className="space-y-4">
          {comparedProperties.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Selecione até 4 imóveis clicando em <strong>Comparar</strong> na
              aba de Imóveis para analisá-los lado a lado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {comparedProperties.map((p) => {
                const key = `${p.provider}:${p.id}`;
                const isFav = favoriteKeys.includes(key);
                const isDeactivated = p.isActive === false;
                const providerStyle = getProviderStyle(p.provider);
                return (
                  <div
                    key={key}
                    className={`flex flex-col justify-between rounded-xl border bg-card p-4 space-y-3 ${
                      isDeactivated ? "opacity-75 border-rose-500/35" : ""
                    }`}
                  >
                    <div className="space-y-3">
                      {p.samplePhotos[0]?.url && (
                        <button
                          type="button"
                          onClick={() =>
                            setGalleryState({ property: p, initialIndex: 0 })
                          }
                          className="group relative block h-48 w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left"
                        >
                          <img
                            src={getCardPhotoUrl(p.samplePhotos[0].url)}
                            referrerPolicy="no-referrer"
                            onError={(e) =>
                              handleImgError(e, p.samplePhotos[0]!.url)
                            }
                            alt={p.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {p.samplePhotos.length > 1 && (
                            <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-xs group-hover:bg-primary">
                              <Images className="h-3 w-3" />
                              Galeria (
                              {Math.max(
                                p.samplePhotos.length,
                                p.photosCount || p.samplePhotos.length,
                              )}
                              )
                            </span>
                          )}
                        </button>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                              CITY_BADGE_INFO[p.cityCode].className
                            }`}
                          >
                            {CITY_BADGE_INFO[p.cityCode].ufLabel}
                          </span>
                          <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                            {p.finalScore.toFixed(1)} pts (#{p.overallRank ?? "—"} Geral · #{p.cityRank ?? "—"} {p.cityCode})
                          </span>
                          {isDeactivated && (
                            <span className="rounded-md border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-200">
                              Desativado / Alugado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(key)}
                            aria-label={
                              isFav
                                ? "Remover dos favoritos"
                                : "Adicionar aos favoritos"
                            }
                            title={
                              isFav
                                ? "Remover dos favoritos"
                                : "Salvar nos favoritos"
                            }
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${
                              isFav
                                ? "border-rose-500/40 bg-rose-500/12 text-rose-600 dark:text-rose-300"
                                : "bg-background text-muted-foreground hover:bg-secondary hover:text-rose-500"
                            }`}
                          >
                            <Heart
                              className={`h-3.5 w-3.5 ${
                                isFav ? "fill-rose-500 text-rose-500" : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCompare(key)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">
                          {p.neighborhood} ({p.cityCode})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {p.street}
                          {p.streetNumber ? `, ${p.streetNumber}` : ""}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/60 p-2.5 font-mono text-xs space-y-1">
                        <div className="flex justify-between font-bold text-sm">
                          <span>Total All-in:</span>
                          <span>
                            R$ {p.totalMonthly.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Aluguel:</span>
                          <span>R$ {p.rent.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Condomínio + IPTU:</span>
                          <span>
                            R$ {(p.condoFee + p.iptu).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Planta / Vagas:</span>
                          <span>
                            {p.areaM2} m² · {p.bedrooms}q · {p.parkingSpaces}v
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Modernidade:</span>
                          <span>{p.modernityScore}/100</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground">
                        {p.narrativeJustification}
                      </p>
                      <details className="group rounded-lg border bg-background/60 p-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                          Ver memória de cálculo e notas quebradas
                        </summary>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          {p.detailedJustification}
                        </p>
                      </details>
                    </div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${providerStyle.cardClassName}`}
                    >
                      Abrir no {providerStyle.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {galleryState && (
        <PropertyPhotoGalleryModal
          property={galleryState.property}
          initialIndex={galleryState.initialIndex}
          isFavorite={favoriteKeys.includes(
            `${galleryState.property.provider}:${galleryState.property.id}`,
          )}
          onToggleFavorite={() =>
            toggleFavorite(
              `${galleryState.property.provider}:${galleryState.property.id}`,
            )
          }
          onPhotosLoaded={(loadedPhotos) => {
            const k = `${galleryState.property.provider}:${galleryState.property.id}`;
            setExtraPhotosByKey((prev) => ({
              ...prev,
              [k]: loadedPhotos,
            }));
          }}
          onClose={() => setGalleryState(null)}
        />
      )}

      <PropertyChatDrawer
        open={showChatDrawer}
        onOpenChange={setShowChatDrawer}
        qaItems={qaItems}
        pinnedProperty={pinnedChatProperty}
        onClearPinnedProperty={() => setPinnedChatPropertyKey(null)}
        onFocusProperty={(propertyKey) => {
          setPinnedChatPropertyKey(propertyKey);
          focusCardInList(propertyKey);
        }}
        onSubmitQuestion={submitChatQuestion}
        onDeleteQuestion={deletePropertyQuestion}
        onClearHistory={clearChatHistory}
        isSubmitting={isSubmittingChatQuestion}
        scrollTargetPropertyKey={chatScrollTargetKey}
        onConsumeScrollTarget={() => setChatScrollTargetKey(null)}
        filteredCount={filteredProperties.length}
      />
    </div>
  );
}
