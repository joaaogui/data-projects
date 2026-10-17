import "server-only";

import { logger } from "@/lib/logger";
import { sanitizeAndMigrateWeights } from "@/lib/scoring-engine";
import type { ScoringWeights, SharedUserPreferences } from "@/types/housing";
import { fetchWithRetry } from "@data-projects/shared/db";
import { neon, neonConfig } from "@neondatabase/serverless";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_PREF_ID = "default";
const LOCAL_PREFS_FILE = join(process.cwd(), "src/data/user-preferences.json");
const FALLBACK_PREFS_FILE = join(
  process.cwd(),
  "apps/housing/src/data/user-preferences.json",
);
const TMP_PREFS_FILE = join(tmpdir(), "housing-user-preferences.json");
const LOCAL_FAVORITES_FILE = join(process.cwd(), "src/data/favorites.json");
const TMP_FAVORITES_FILE = join(tmpdir(), "housing-favorites.json");

const DEFAULT_COMPARE_KEYS = [
  "quintoandar:893127481",
  "zapimoveis:2900134401",
  "quintoandar:895394820",
];

function normalizeStringArray(raw: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(raw)) return fallback;
  return [
    ...new Set(
      raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0),
    ),
  ];
}

export function normalizePreferences(
  raw: Record<string, unknown> | null | undefined,
  fallback?: SharedUserPreferences,
): SharedUserPreferences {
  const base = fallback ?? {
    schemaVersion: 2,
    filters: {},
    weights: {},
    activePresetId: "balanced-original",
    favorites: [],
    compareKeys: DEFAULT_COMPARE_KEYS,
    updatedAt: new Date(0).toISOString(),
  };
  if (!raw || typeof raw !== "object") return base;

  const filters =
    raw.filters && typeof raw.filters === "object" && !Array.isArray(raw.filters)
      ? (raw.filters as Record<string, unknown>)
      : base.filters;
  const rawWeightsObj =
    raw.weights && typeof raw.weights === "object" && !Array.isArray(raw.weights)
      ? (raw.weights as Partial<ScoringWeights>)
      : base.weights;
  const isV2 =
    raw.schemaVersion === 2 ||
    raw.schema_version === 2 ||
    (raw.filters &&
      typeof raw.filters === "object" &&
      !Array.isArray(raw.filters) &&
      (raw.filters as Record<string, unknown>).schemaVersion === 2);
  const weights: Partial<ScoringWeights> = sanitizeAndMigrateWeights(
    rawWeightsObj,
    isV2 ? 2 : 1,
  );
  const activePresetId =
    typeof raw.activePresetId === "string" && raw.activePresetId.trim()
      ? raw.activePresetId.trim()
      : typeof raw.active_preset_id === "string" && raw.active_preset_id.trim()
        ? raw.active_preset_id.trim()
        : base.activePresetId;
  const favorites = Array.isArray(raw.favorites)
    ? normalizeStringArray(raw.favorites)
    : base.favorites;
  const rawCompare = raw.compareKeys ?? raw.compare_keys;
  let compareKeys: string[] = base.compareKeys;
  if (Array.isArray(rawCompare)) {
    compareKeys = normalizeStringArray(rawCompare);
  } else if (typeof rawCompare === "string" && rawCompare.trim().startsWith("[")) {
    try {
      const parsedCompare = JSON.parse(rawCompare) as unknown;
      if (Array.isArray(parsedCompare)) {
        compareKeys = normalizeStringArray(parsedCompare);
      }
    } catch {
      // fall back to base.compareKeys
    }
  }
  const rawUpdated = raw.updatedAt ?? raw.updated_at;
  const updatedAt =
    rawUpdated instanceof Date
      ? rawUpdated.toISOString()
      : typeof rawUpdated === "string" && rawUpdated.trim()
        ? new Date(rawUpdated).toISOString()
        : base.updatedAt;

  return {
    schemaVersion: 2,
    filters,
    weights,
    activePresetId,
    favorites,
    compareKeys,
    updatedAt,
  };
}

let memPreferencesCache: SharedUserPreferences | null = null;
let lastLoadedFromDb = false;
let lastDbLoadTimeMs = 0;
const PREFS_DB_CACHE_TTL_MS = 2_500;
let inFlightLoadPrefsPromise: Promise<SharedUserPreferences> | null = null;

export function loadLocalPreferencesFallback(): SharedUserPreferences {
  if (memPreferencesCache) {
    return memPreferencesCache;
  }
  for (const candidate of [TMP_PREFS_FILE, LOCAL_PREFS_FILE, FALLBACK_PREFS_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const parsed = JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ candidate, "utf8"),
        ) as Record<string, unknown>;
        const normalized = normalizePreferences(parsed);
        memPreferencesCache = normalized;
        return normalized;
      } catch {
        // try next
      }
    }
  }
  const normalized = normalizePreferences(null);
  memPreferencesCache = normalized;
  return normalized;
}

function writeLocalPreferencesMirror(prefs: SharedUserPreferences): void {
  const cleanPrefs: SharedUserPreferences = {
    schemaVersion: prefs.schemaVersion ?? 2,
    filters: prefs.filters,
    weights: prefs.weights,
    activePresetId: prefs.activePresetId,
    favorites: prefs.favorites,
    compareKeys: prefs.compareKeys,
    updatedAt: prefs.updatedAt,
  };
  memPreferencesCache = cleanPrefs;
  const serialized = `${JSON.stringify(cleanPrefs, null, 2)}\n`;
  const favsSerialized = `${JSON.stringify(cleanPrefs.favorites, null, 2)}\n`;
  for (const target of [LOCAL_PREFS_FILE, TMP_PREFS_FILE]) {
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, serialized, "utf8");
    } catch {
      // Ignore read-only filesystem errors in serverless environments
    }
  }
  for (const favTarget of [LOCAL_FAVORITES_FILE, TMP_FAVORITES_FILE]) {
    try {
      mkdirSync(dirname(favTarget), { recursive: true });
      writeFileSync(favTarget, favsSerialized, "utf8");
    } catch {
      // Ignore read-only filesystem errors
    }
  }
}

function getSqlClient() {
  const url = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
  if (!url) return null;
  neonConfig.fetchFunction = fetchWithRetry;
  return neon(url);
}

let tableEnsuredPromise: Promise<void> | null = null;

async function ensurePreferencesTable(): Promise<void> {
  const sql = getSqlClient();
  if (!sql) return;
  if (!tableEnsuredPromise) {
    tableEnsuredPromise = (async () => {
      await sql`CREATE SCHEMA IF NOT EXISTS housing`;
      await sql`
        CREATE TABLE IF NOT EXISTS housing.user_preferences (
          id text PRIMARY KEY,
          filters jsonb NOT NULL DEFAULT '{}'::jsonb,
          weights jsonb NOT NULL DEFAULT '{}'::jsonb,
          active_preset_id text NOT NULL DEFAULT 'balanced-original',
          favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
          compare_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      tableEnsuredPromise = null;
      throw err;
    });
  }
  return tableEnsuredPromise;
}

export async function loadSharedPreferences(options?: {
  forceDbRefresh?: boolean;
}): Promise<SharedUserPreferences> {
  const fallback = loadLocalPreferencesFallback();
  const sql = getSqlClient();
  if (!sql) {
    lastLoadedFromDb = false;
    return fallback;
  }

  if (
    !options?.forceDbRefresh &&
    memPreferencesCache &&
    lastLoadedFromDb &&
    Date.now() - lastDbLoadTimeMs < PREFS_DB_CACHE_TTL_MS
  ) {
    return memPreferencesCache;
  }

  if (!options?.forceDbRefresh && inFlightLoadPrefsPromise) {
    return inFlightLoadPrefsPromise;
  }

  const loadPromise = (async (): Promise<SharedUserPreferences> => {
    try {
      await ensurePreferencesTable();
      const rows = await sql`
        SELECT id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
        FROM housing.user_preferences
        WHERE id = ${DEFAULT_PREF_ID}
        LIMIT 1
      `;
      if (rows.length > 0) {
        const prefs = normalizePreferences(
          rows[0] as Record<string, unknown>,
          fallback,
        );
        memPreferencesCache = prefs;
        lastLoadedFromDb = true;
        lastDbLoadTimeMs = Date.now();
        return prefs;
      }

      const seededRows = await sql`
        INSERT INTO housing.user_preferences (
          id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
        )
        VALUES (
          ${DEFAULT_PREF_ID},
          ${JSON.stringify(fallback.filters)}::jsonb,
          ${JSON.stringify(fallback.weights)}::jsonb,
          ${fallback.activePresetId},
          ${JSON.stringify(fallback.favorites)}::jsonb,
          ${JSON.stringify(fallback.compareKeys)}::jsonb,
          now()
        )
        ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
        RETURNING id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
      `;
      const seeded = normalizePreferences(
        seededRows[0] as Record<string, unknown>,
        fallback,
      );
      memPreferencesCache = seeded;
      lastLoadedFromDb = true;
      lastDbLoadTimeMs = Date.now();
      return seeded;
    } catch (err) {
      logger.warn(
        "preferences-store",
        "loadSharedPreferences DB query failed; using local fallback",
        { error: err },
      );
      lastLoadedFromDb = false;
      return fallback;
    } finally {
      inFlightLoadPrefsPromise = null;
    }
  })();

  inFlightLoadPrefsPromise = loadPromise;
  return loadPromise;
}

export function wasLastPreferencesLoadedFromDb(): boolean {
  return lastLoadedFromDb;
}

let saveQueuePromise: Promise<unknown> = Promise.resolve();

export async function saveSharedPreferences(
  partial: Partial<Omit<SharedUserPreferences, "updatedAt">> & {
    clientUpdatedAt?: string;
  },
): Promise<SharedUserPreferences & { persistedToDb: boolean }> {
  const runSave = async (): Promise<
    SharedUserPreferences & { persistedToDb: boolean }
  > => {
    const current = await loadSharedPreferences();
    const nowMs = Date.now();
    const currentMs = Date.parse(current.updatedAt || "");
    const clientMs = partial.clientUpdatedAt
      ? Date.parse(partial.clientUpdatedAt)
      : Number.NaN;

    if (
      Number.isFinite(clientMs) &&
      Number.isFinite(currentMs) &&
      clientMs < currentMs
    ) {
      logger.warn(
        "preferences-store",
        "saveSharedPreferences ignored stale clientUpdatedAt",
        {
          clientUpdatedAt: partial.clientUpdatedAt,
          currentUpdatedAt: current.updatedAt,
        },
      );
      return { ...current, persistedToDb: lastLoadedFromDb };
    }

    const effectiveMs = Number.isFinite(currentMs)
      ? Math.max(nowMs, currentMs + 1)
      : nowMs;
    const nowIso = new Date(effectiveMs).toISOString();
    const hasFilters =
      partial.filters !== undefined &&
      partial.filters !== null &&
      typeof partial.filters === "object" &&
      !Array.isArray(partial.filters);
    const hasWeights =
      partial.weights !== undefined &&
      partial.weights !== null &&
      typeof partial.weights === "object" &&
      !Array.isArray(partial.weights);
    const hasActivePresetId =
      typeof partial.activePresetId === "string" &&
      partial.activePresetId.trim().length > 0;
    const hasFavorites = Array.isArray(partial.favorites);
    const hasCompareKeys = Array.isArray(partial.compareKeys);

    const resolvedFilters = hasFilters
      ? (partial.filters as Record<string, unknown>)
      : current.filters;
    const next: SharedUserPreferences = {
      schemaVersion: 2,
      filters: { ...resolvedFilters, schemaVersion: 2 },
      weights: hasWeights
        ? sanitizeAndMigrateWeights(
            { ...current.weights, ...partial.weights },
            2,
          )
        : sanitizeAndMigrateWeights(current.weights, 2),
      activePresetId: hasActivePresetId
        ? partial.activePresetId!.trim()
        : current.activePresetId,
      favorites: hasFavorites
        ? normalizeStringArray(partial.favorites)
        : current.favorites,
      compareKeys: hasCompareKeys
        ? normalizeStringArray(partial.compareKeys)
        : current.compareKeys,
      updatedAt: nowIso,
    };

    writeLocalPreferencesMirror(next);

    const sql = getSqlClient();
    if (!sql) return { ...next, persistedToDb: false };

    try {
      await ensurePreferencesTable();
      const rows = await sql`
        INSERT INTO housing.user_preferences (
          id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
        )
        VALUES (
          ${DEFAULT_PREF_ID},
          ${JSON.stringify(next.filters)}::jsonb,
          ${JSON.stringify(next.weights)}::jsonb,
          ${next.activePresetId},
          ${JSON.stringify(next.favorites)}::jsonb,
          ${JSON.stringify(next.compareKeys)}::jsonb,
          ${nowIso}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          filters = COALESCE(${hasFilters ? JSON.stringify(next.filters) : null}::jsonb, housing.user_preferences.filters),
          weights = COALESCE(${hasWeights ? JSON.stringify(next.weights) : null}::jsonb, housing.user_preferences.weights),
          active_preset_id = COALESCE(${hasActivePresetId ? next.activePresetId : null}::text, housing.user_preferences.active_preset_id),
          favorites = COALESCE(${hasFavorites ? JSON.stringify(next.favorites) : null}::jsonb, housing.user_preferences.favorites),
          compare_keys = COALESCE(${hasCompareKeys ? JSON.stringify(next.compareKeys) : null}::jsonb, housing.user_preferences.compare_keys),
          updated_at = EXCLUDED.updated_at
        WHERE housing.user_preferences.updated_at <= ${nowIso}::timestamptz
        RETURNING id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
      `;
      if (rows.length > 0) {
        const saved = normalizePreferences(
          rows[0] as Record<string, unknown>,
          next,
        );
        writeLocalPreferencesMirror(saved);
        lastLoadedFromDb = true;
        lastDbLoadTimeMs = Date.now();
        return { ...saved, persistedToDb: true };
      }
    } catch (err) {
      logger.warn(
        "preferences-store",
        "saveSharedPreferences DB write failed; saved to local mirror only",
        { error: err },
      );
    }
    return { ...next, persistedToDb: false };
  };

  const nextTask = saveQueuePromise.then(runSave, runSave);
  saveQueuePromise = nextTask.catch(() => {});
  return nextTask;
}

export async function toggleSharedFavorite(
  key: string,
  favorite?: boolean,
): Promise<string[]> {
  const trimmedKey = key.trim();
  const currentPrefs = await loadSharedPreferences();
  const favSet = new Set(currentPrefs.favorites);
  if (trimmedKey) {
    const shouldBeFav =
      typeof favorite === "boolean" ? favorite : !favSet.has(trimmedKey);
    if (shouldBeFav) {
      favSet.add(trimmedKey);
    } else {
      favSet.delete(trimmedKey);
    }
  }
  const saved = await saveSharedPreferences({ favorites: [...favSet] });
  return saved.favorites;
}
