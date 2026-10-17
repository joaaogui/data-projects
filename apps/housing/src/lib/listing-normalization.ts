import type { SlimPropertyRecord } from "@/types/housing";
import { PHOTO_AUDIT_OVERRIDES } from "./photo-audit-overrides";

export const IPTU_ESTIMATE_PER_M2 = 2.5;
const IPTU_IMPLAUSIBLE_PER_M2 = 1;
const DUPLICATE_RENT_TOLERANCE = 0.03;
const DUPLICATE_CONDO_TOLERANCE = 0.05;
const DUPLICATE_AREA_TOLERANCE = 0.1;
const DUPLICATE_AREA_TOLERANCE_SAME_RENT = 0.25;

export const PROVIDER_LABELS: Record<SlimPropertyRecord["provider"], string> = {
  quintoandar: "QuintoAndar",
  zapimoveis: "Zap Imóveis",
  zap: "Zap Imóveis",
  vivareal: "VivaReal",
  netimoveis: "Netimóveis",
  imovelweb: "Imovelweb",
};

const listingKey = (p: Pick<SlimPropertyRecord, "provider" | "id">) => `${p.provider}:${p.id}`;

function parseBrlAmount(raw: string): number | null {
  const n = Number(raw.replace(/\./g, "").replace(/,\d{1,2}$/, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Highest monthly rent stated in the owner's text ("Aluguel: R$ 4.200,00", "valor do aluguel R$ 4.200").
 * Package prices ("aluguel + condomínio", "valor total do aluguel") are ignored.
 */
export function extractDescriptionRent(text: string | null | undefined): number | null {
  if (!text) return null;
  let best: number | null = null;
  const re =
    /\baluguel\s*(?:mensal\s*)?(?::|=|-|é|de)?\s*(?:de\s+)?R\$\s*(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,\d{1,2})?/gi;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 25), idx);
    if (/\b(total|pacote)\b[^.;\n]*$/i.test(before)) continue;
    const after = text.slice(idx + m[0].length, idx + m[0].length + 30);
    if (/^\s*(?:\+|com\s+condom|j[aá]\s+incl|incluso|inclu[ií]d)/i.test(after)) continue;
    const value = parseBrlAmount(m[1]!);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

const IPTU_ESTIMATE_TEXT = /\bIPTU\s+(?:sob|por|em|a)\s+estimativa\b|\bIPTU\s+estimad[oa]\b/i;
const IPTU_EXEMPT_TEXT =
  /\bIPTU\s+(?:isento|isen[cç][aã]o|inclu[ií]do|incluso)\b|\bisent[oa]\s+de\s+IPTU\b|\bIPTU\s+j[aá]\s+inclu/i;

/** Rent/IPTU fixes for a single listing (before cross-portal merging). */
function resolvePricePatch(p: SlimPropertyRecord): Partial<SlimPropertyRecord> {
  const patch: Partial<SlimPropertyRecord> = {};
  const ownText = [p.title ?? "", p.description ?? ""].join(". ");
  let total = p.totalMonthly;

  const statedRent = extractDescriptionRent(p.description);
  if (
    statedRent !== null &&
    p.rent > 0 &&
    statedRent > p.rent * 1.01 &&
    statedRent <= p.rent * 1.5 &&
    Math.abs(statedRent - p.totalMonthly) > p.totalMonthly * 0.02
  ) {
    patch.listedRent = p.rent;
    patch.rent = statedRent;
    total += statedRent - p.rent;
  }

  if (p.areaM2 > 0 && !IPTU_EXEMPT_TEXT.test(ownText)) {
    const estimate = Math.round(p.areaM2 * IPTU_ESTIMATE_PER_M2);
    const isImplausible =
      IPTU_ESTIMATE_TEXT.test(ownText) || p.iptu < p.areaM2 * IPTU_IMPLAUSIBLE_PER_M2;
    if (isImplausible && estimate > p.iptu) {
      patch.listedIptu = p.iptu;
      patch.iptu = estimate;
      total += estimate - p.iptu;
    }
  }

  if (total !== p.totalMonthly) patch.totalMonthly = total;
  return patch;
}

function normalizeAddressPart(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(?:r|rua)\.?\s+/, "rua ")
    .replace(/^(?:av|avenida)\.?\s+/, "avenida ")
    .replace(/^(?:al|alameda)\.?\s+/, "alameda ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressKey(p: SlimPropertyRecord): string | null {
  const street = normalizeAddressPart(p.street);
  const number = (p.streetNumber ?? "").replace(/\D+/g, "");
  if (!street || !number || /\bnao informad/.test(street)) return null;
  return `${p.cityCode}|${street}|${number}`;
}

const within = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= Math.max(a, b) * tolerance;

/** Zap/VivaReal CRMs default the unit floor to 0 or 1, so those values are not evidence for a twin. */
function reliableFloor(p: SlimPropertyRecord): number | null {
  const isZapFamily = p.provider === "zapimoveis" || p.provider === "zap" || p.provider === "vivareal";
  return isZapFamily && p.floor !== null && p.floor <= 1 ? null : p.floor;
}

function floorSpan(p: SlimPropertyRecord): { min: number; max: number } | null {
  const floor = reliableFloor(p);
  if (floor !== null) return { min: floor, max: floor };
  return p.floorRange;
}

function isSameUnit(a: SlimPropertyRecord, b: SlimPropertyRecord): boolean {
  if (a.provider === b.provider || a.bedrooms !== b.bedrooms) return false;
  if (!within(a.rent, b.rent, DUPLICATE_RENT_TOLERANCE)) return false;
  if (a.condoFee > 0 && b.condoFee > 0 && !within(a.condoFee, b.condoFee, DUPLICATE_CONDO_TOLERANCE)) {
    return false;
  }
  // Portals round the area differently; a looser area match needs the exact same rent.
  const areaTolerance = a.rent === b.rent ? DUPLICATE_AREA_TOLERANCE_SAME_RENT : DUPLICATE_AREA_TOLERANCE;
  if (a.areaM2 > 0 && b.areaM2 > 0 && !within(a.areaM2, b.areaM2, areaTolerance)) {
    return false;
  }
  const fa = floorSpan(a);
  const fb = floorSpan(b);
  return !fa || !fb || (fa.min <= fb.max && fb.min <= fa.max);
}

/** Groups of the same unit listed on different portals (same address, rent, condo fee, bedrooms). */
export function findCrossPortalDuplicateGroups(
  properties: SlimPropertyRecord[],
): SlimPropertyRecord[][] {
  const byAddress = new Map<string, SlimPropertyRecord[]>();
  for (const p of properties) {
    if (p.isActive === false) continue;
    const key = addressKey(p);
    if (!key) continue;
    const bucket = byAddress.get(key);
    if (bucket) bucket.push(p);
    else byAddress.set(key, [p]);
  }
  const groups: SlimPropertyRecord[][] = [];
  for (const bucket of byAddress.values()) {
    const remaining = bucket.slice();
    while (remaining.length > 1) {
      const seed = remaining.shift()!;
      const group = [seed];
      for (let i = remaining.length - 1; i >= 0; i--) {
        const candidate = remaining[i]!;
        if (group.every((g) => isSameUnit(g, candidate))) {
          group.push(candidate);
          remaining.splice(i, 1);
        }
      }
      if (group.length > 1) groups.push(group);
    }
  }
  return groups;
}

function firstDefined<T>(values: Array<T | null | undefined>): T | null {
  for (const v of values) if (v !== null && v !== undefined) return v;
  return null;
}

/** Fills each copy's gaps from its twins: missing floor/doorman/description, the smaller area, the earliest publication. */
function resolveDuplicatePatch(
  p: SlimPropertyRecord,
  group: SlimPropertyRecord[],
): Partial<SlimPropertyRecord> {
  const others = group.filter((o) => o !== p);
  const patch: Partial<SlimPropertyRecord> = {
    alsoListedOn: others.map(listingKey),
  };
  if (reliableFloor(p) === null) {
    const floor = firstDefined(others.map(reliableFloor));
    if (floor !== null) patch.floor = floor;
  }
  if (p.floorRange === null && (patch.floor ?? reliableFloor(p)) === null) {
    const range = firstDefined(others.map((o) => o.floorRange));
    if (range) {
      patch.floorRange = range;
      if (p.floor !== null) patch.floor = null;
    }
  }
  if (p.totalFloors === null) {
    const totalFloors = firstDefined(others.map((o) => o.totalFloors));
    if (totalFloors !== null) patch.totalFloors = totalFloors;
  }
  if (p.doorman === null) {
    const doorman = firstDefined(others.map((o) => o.doorman));
    if (doorman !== null) patch.doorman = doorman;
  }
  if (p.condominiumName === null) {
    const name = firstDefined(others.map((o) => o.condominiumName));
    if (name !== null) patch.condominiumName = name;
  }
  if (!p.description) {
    const description = firstDefined(others.map((o) => o.description || null));
    if (description) patch.description = description;
  }
  const areas = group.map((o) => o.areaM2).filter((a) => a > 0);
  const minArea = areas.length > 0 ? Math.min(...areas) : p.areaM2;
  if (minArea < p.areaM2) patch.areaM2 = minArea;

  const published = group
    .map((o) => o.publishedAt)
    .filter((d): d is string => Boolean(d) && Number.isFinite(Date.parse(d!)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  if (published[0] && published[0] !== p.publishedAt) patch.publishedAt = published[0];

  if (others.some((o) => PHOTO_AUDIT_OVERRIDES[listingKey(o)]?.verifiedAC)) {
    patch.twinAcConfirmed = true;
  }
  return patch;
}

const normalizedCache = new WeakMap<SlimPropertyRecord, { sig: string; copy: SlimPropertyRecord }>();

/**
 * Data-level fixes applied before scoring: rent stated in the description, estimated IPTU, and gap
 * filling between cross-portal duplicates. Returns the original object when nothing changes and a
 * stable copy otherwise, so the engine's per-object caches keep working.
 */
export function prepareListingsForScoring(properties: SlimPropertyRecord[]): SlimPropertyRecord[] {
  const duplicatePatches = new Map<SlimPropertyRecord, Partial<SlimPropertyRecord>>();
  for (const group of findCrossPortalDuplicateGroups(properties)) {
    for (const p of group) duplicatePatches.set(p, resolveDuplicatePatch(p, group));
  }

  return properties.map((p) => {
    const merged = { ...p, ...duplicatePatches.get(p) };
    const patch = { ...duplicatePatches.get(p), ...resolvePricePatch(merged) };
    if (Object.keys(patch).length === 0) return p;
    const sig = JSON.stringify(patch);
    const cached = normalizedCache.get(p);
    if (cached && cached.sig === sig) return cached.copy;
    const copy = { ...p, ...patch };
    normalizedCache.set(p, { sig, copy });
    return copy;
  });
}
