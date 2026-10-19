import "server-only";

import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import type { PropertyQuestionItem, PropertyQuestionSnapshot } from "@/types/housing";
import { sql } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Card Q&A lives in housing.property_qa (one row). Without a database (local dev) it falls back
 * to a JSON file in the OS temp dir.
 */
const DEFAULT_QA_ROW_ID = "default";
const TMP_QA_FILE = join(tmpdir(), "housing-property-qa.json");
const QA_DB_CACHE_TTL_MS = 4_000;

export function sanitizePropertySnapshot(
  raw: unknown,
  fallback?: Partial<PropertyQuestionSnapshot>,
): PropertyQuestionSnapshot {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const fb = fallback ?? {};

  const strField = (key: keyof PropertyQuestionSnapshot, def = "", max = 2000): string => {
    const v = src[key];
    if (typeof v === "string") return v.slice(0, max);
    const fv = fb[key];
    return typeof fv === "string" ? fv.slice(0, max) : def;
  };

  const nullStrField = (
    key: keyof PropertyQuestionSnapshot,
    def: string | null = null,
    max = 2000,
  ): string | null => {
    const v = src[key];
    if (v === null) return null;
    if (typeof v === "string") return v.slice(0, max);
    const fv = fb[key];
    return typeof fv === "string" ? fv.slice(0, max) : def;
  };

  const numField = (key: keyof PropertyQuestionSnapshot, def = 0): number => {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const fv = fb[key];
    return typeof fv === "number" && Number.isFinite(fv) ? fv : def;
  };

  const nullNumField = (
    key: keyof PropertyQuestionSnapshot,
    def: number | null = null,
  ): number | null => {
    const v = src[key];
    if (v === null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const fv = fb[key];
    return typeof fv === "number" && Number.isFinite(fv) ? fv : def;
  };

  const strArrayField = (
    key: keyof PropertyQuestionSnapshot,
  ): string[] | undefined => {
    const v = src[key] ?? fb[key];
    if (!Array.isArray(v)) return undefined;
    return v
      .filter((x): x is string => typeof x === "string")
      .slice(0, 30)
      .map((s) => s.slice(0, 300));
  };

  const rawTier = src.furnitureTier ?? fb.furnitureTier;
  // Snapshots persisted before the two-tier model may still say "SEMI_FURNISHED".
  const furnitureTier =
    rawTier === "UNFURNISHED" || rawTier === "FULLY_FURNISHED"
      ? rawTier
      : rawTier === "SEMI_FURNISHED"
        ? "UNFURNISHED"
        : undefined;

  const rawBd = src.breakdown ?? fb.breakdown;
  const breakdown =
    rawBd && typeof rawBd === "object" && !Array.isArray(rawBd)
      ? {
          neighborhoodPoints:
            typeof (rawBd as Record<string, unknown>).neighborhoodPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).neighborhoodPoints)
              ? ((rawBd as Record<string, number>).neighborhoodPoints ?? 0)
              : (fb.breakdown?.neighborhoodPoints ?? 0),
          modernityPoints:
            typeof (rawBd as Record<string, unknown>).modernityPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).modernityPoints)
              ? ((rawBd as Record<string, number>).modernityPoints ?? 0)
              : (fb.breakdown?.modernityPoints ?? 0),
          nuancesPoints:
            typeof (rawBd as Record<string, unknown>).nuancesPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).nuancesPoints)
              ? ((rawBd as Record<string, number>).nuancesPoints ?? 0)
              : (fb.breakdown?.nuancesPoints ?? 0),
          budgetPoints:
            typeof (rawBd as Record<string, unknown>).budgetPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).budgetPoints)
              ? ((rawBd as Record<string, number>).budgetPoints ?? 0)
              : (fb.breakdown?.budgetPoints ?? 0),
          furniturePoints:
            typeof (rawBd as Record<string, unknown>).furniturePoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).furniturePoints)
              ? ((rawBd as Record<string, number>).furniturePoints ?? 0)
              : (fb.breakdown?.furniturePoints ?? 0),
          areaPoints:
            typeof (rawBd as Record<string, unknown>).areaPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).areaPoints)
              ? ((rawBd as Record<string, number>).areaPoints ?? 0)
              : (fb.breakdown?.areaPoints ?? 0),
          parkingPoints:
            typeof (rawBd as Record<string, unknown>).parkingPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).parkingPoints)
              ? ((rawBd as Record<string, number>).parkingPoints ?? 0)
              : (fb.breakdown?.parkingPoints ?? 0),
          safetyPoints:
            typeof (rawBd as Record<string, unknown>).safetyPoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).safetyPoints)
              ? ((rawBd as Record<string, number>).safetyPoints ?? 0)
              : (fb.breakdown?.safetyPoints ?? 0),
          commutePoints:
            typeof (rawBd as Record<string, unknown>).commutePoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).commutePoints)
              ? ((rawBd as Record<string, number>).commutePoints ?? 0)
              : (fb.breakdown?.commutePoints ?? 0),
          cityPreferencePoints:
            typeof (rawBd as Record<string, unknown>).cityPreferencePoints === "number" &&
            Number.isFinite((rawBd as Record<string, unknown>).cityPreferencePoints)
              ? ((rawBd as Record<string, number>).cityPreferencePoints ?? 0)
              : (fb.breakdown?.cityPreferencePoints ?? 0),
        }
      : fb.breakdown;

  const rawFr = src.floorRange ?? fb.floorRange;
  const floorRange =
    rawFr &&
    typeof rawFr === "object" &&
    !Array.isArray(rawFr) &&
    typeof (rawFr as Record<string, unknown>).min === "number" &&
    Number.isFinite((rawFr as Record<string, unknown>).min) &&
    typeof (rawFr as Record<string, unknown>).max === "number" &&
    Number.isFinite((rawFr as Record<string, unknown>).max)
      ? {
          min: (rawFr as { min: number }).min,
          max: (rawFr as { max: number }).max,
        }
      : (fb.floorRange ?? null);

  return {
    title: strField("title", "", 500),
    neighborhood: strField("neighborhood", "", 200),
    cityCode: strField("cityCode", "", 20),
    street: strField("street", "", 300),
    streetNumber: nullStrField("streetNumber", null, 60),
    condominiumName: nullStrField("condominiumName", null, 300),
    totalMonthly: numField("totalMonthly", 0),
    rent: numField("rent", 0),
    condoFee: numField("condoFee", 0),
    iptu: numField("iptu", 0),
    areaM2: numField("areaM2", 0),
    bedrooms: numField("bedrooms", 0),
    bathrooms: numField("bathrooms", 0),
    parkingSpaces: numField("parkingSpaces", 0),
    floor: nullNumField("floor", null),
    floorLabel: nullStrField("floorLabel", null, 120),
    furnished:
      typeof src.furnished === "boolean"
        ? src.furnished
        : typeof fb.furnished === "boolean"
          ? fb.furnished
          : null,
    modernityScore: numField("modernityScore", 0),
    finalScore: numField("finalScore", 0),
    overallRank: nullNumField("overallRank", null),
    cityRank: nullNumField("cityRank", null),
    furnitureTier,
    breakdown,
    url: strField("url", "", 1000),
    shortJustification: strField("shortJustification", "", 2000),
    description: nullStrField("description", null, 2000),
    thumbnailUrl: nullStrField("thumbnailUrl", null, 1000),
    suites: numField("suites", fb.suites ?? 0),
    totalFloors: nullNumField("totalFloors", fb.totalFloors ?? null),
    floorRange,
    constructionYear: nullNumField("constructionYear", fb.constructionYear ?? null),
    doorman: nullStrField("doorman", fb.doorman ?? null, 120),
    acLabel: nullStrField("acLabel", fb.acLabel ?? null, 120),
    greenTags: strArrayField("greenTags"),
    redTags: strArrayField("redTags"),
    nuanceHighlights: strArrayField("nuanceHighlights"),
    nuanceWarnings: strArrayField("nuanceWarnings"),
    eligible:
      typeof src.eligible === "boolean"
        ? src.eligible
        : typeof fb.eligible === "boolean"
          ? fb.eligible
          : undefined,
    exclusionReason: nullStrField("exclusionReason", fb.exclusionReason ?? null, 600),
  };
}

export function parseQaRaw(raw: unknown): PropertyQuestionItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        "items" in raw &&
        Array.isArray((raw as { items: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  return list
    .filter((item): item is Record<string, unknown> =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).id === "string" &&
          typeof (item as Record<string, unknown>).propertyKey === "string",
      ),
    )
    .map((item) => ({
      id: String(item.id).slice(0, 120),
      propertyKey: String(item.propertyKey).slice(0, 120),
      question:
        typeof item.question === "string" ? item.question.slice(0, 1500) : "",
      status: item.status === "pending" ? "pending" : "answered",
      answer:
        typeof item.answer === "string" ? item.answer.slice(0, 12000) : null,
      answerSource:
        item.answerSource === "llm" ||
        item.answerSource === "cursor_session" ||
        item.answerSource === "instant_diagnostic"
          ? item.answerSource
          : "instant_diagnostic",
      instantAnswer:
        typeof item.instantAnswer === "string"
          ? item.instantAnswer.slice(0, 12000)
          : null,
      awaitingDetailedAnswer: item.awaitingDetailedAnswer === true,
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt.slice(0, 64)
          : new Date().toISOString(),
      answeredAt:
        typeof item.answeredAt === "string"
          ? item.answeredAt.slice(0, 64)
          : null,
      propertySnapshot: sanitizePropertySnapshot(item.propertySnapshot),
    }));
}

export function preservedInstantAnswer(item: PropertyQuestionItem): string | null {
  if (item.instantAnswer) return item.instantAnswer;
  return item.answerSource !== "cursor_session" ? item.answer : null;
}

let memQaItems: PropertyQuestionItem[] | null = null;
let lastQaDbLoadMs = 0;
let qaStoreWriteVersion = 0;
let inFlightQaLoad: Promise<PropertyQuestionItem[]> | null = null;

function readTmpQaItems(): PropertyQuestionItem[] {
  if (!existsSync(/*turbopackIgnore: true*/ TMP_QA_FILE)) return [];
  try {
    return parseQaRaw(JSON.parse(readFileSync(/*turbopackIgnore: true*/ TMP_QA_FILE, "utf8")));
  } catch {
    return [];
  }
}

export async function loadQaStore(options?: { bypassCache?: boolean }): Promise<PropertyQuestionItem[]> {
  const db = getDb();
  if (!db) {
    memQaItems ??= readTmpQaItems();
    return [...memQaItems];
  }
  if (!options?.bypassCache && memQaItems !== null && Date.now() - lastQaDbLoadMs < QA_DB_CACHE_TTL_MS) {
    return [...memQaItems];
  }
  if (!options?.bypassCache && inFlightQaLoad) return [...(await inFlightQaLoad)];

  const versionAtStart = qaStoreWriteVersion;
  inFlightQaLoad = (async () => {
    try {
      const result = await db.execute(
        sql`SELECT items FROM housing.property_qa WHERE id = ${DEFAULT_QA_ROW_ID} LIMIT 1`,
      );
      const items = parseQaRaw((result.rows[0] as { items?: unknown } | undefined)?.items ?? []);
      if (qaStoreWriteVersion === versionAtStart) {
        memQaItems = items;
        lastQaDbLoadMs = Date.now();
      }
      return memQaItems ?? items;
    } catch (err) {
      logger.warn("qa-store", "load failed; serving last known items", { error: err });
      return memQaItems ?? [];
    } finally {
      inFlightQaLoad = null;
    }
  })();
  return [...(await inFlightQaLoad)];
}

/** Open `?stream=1` connections on this instance, notified right after a write. */
export const qaChangeListeners = new Set<() => void>();

export async function saveQaItems(items: PropertyQuestionItem[]): Promise<void> {
  qaStoreWriteVersion += 1;
  inFlightQaLoad = null;
  memQaItems = [...items];
  lastQaDbLoadMs = Date.now();
  for (const listener of qaChangeListeners) listener();
  const db = getDb();
  if (!db) {
    const partial = `${TMP_QA_FILE}.${process.pid}.partial`;
    await writeFile(partial, JSON.stringify({ items }), "utf8");
    await rename(partial, TMP_QA_FILE);
    return;
  }
  await db.execute(sql`
    INSERT INTO housing.property_qa (id, items, updated_at)
    VALUES (${DEFAULT_QA_ROW_ID}, ${JSON.stringify(items)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, updated_at = now()
  `);
}
