import "server-only";

import type { ScoringWeights, SharedUserPreferences } from "@/types/moradia";
import { fetchWithRetry } from "@data-projects/shared/db";
import { neon, neonConfig } from "@neondatabase/serverless";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_PREF_ID = "default";
const LOCAL_PREFS_FILE = join(process.cwd(), "src/data/user-preferences.json");
const FALLBACK_PREFS_FILE = join(
  process.cwd(),
  "apps/moradia/src/data/user-preferences.json",
);
const TMP_PREFS_FILE = join(tmpdir(), "moradia-user-preferences.json");
const LOCAL_FAVORITES_FILE = join(process.cwd(), "src/data/favorites.json");
const TMP_FAVORITES_FILE = join(tmpdir(), "moradia-favorites.json");

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

function normalizePreferences(
  raw: Record<string, unknown> | null | undefined,
  fallback?: SharedUserPreferences,
): SharedUserPreferences {
  const base = fallback ?? {
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
  const weights =
    raw.weights && typeof raw.weights === "object" && !Array.isArray(raw.weights)
      ? (raw.weights as Partial<ScoringWeights>)
      : base.weights;
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
  const compareKeys = Array.isArray(rawCompare)
    ? normalizeStringArray(rawCompare)
    : base.compareKeys;
  const rawUpdated = raw.updatedAt ?? raw.updated_at;
  const updatedAt =
    rawUpdated instanceof Date
      ? rawUpdated.toISOString()
      : typeof rawUpdated === "string" && rawUpdated.trim()
        ? new Date(rawUpdated).toISOString()
        : base.updatedAt;

  return {
    filters,
    weights,
    activePresetId,
    favorites,
    compareKeys,
    updatedAt,
  };
}

export function loadLocalPreferencesFallback(): SharedUserPreferences {
  for (const candidate of [TMP_PREFS_FILE, LOCAL_PREFS_FILE, FALLBACK_PREFS_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const parsed = JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ candidate, "utf8"),
        ) as Record<string, unknown>;
        return normalizePreferences(parsed);
      } catch {
        // try next
      }
    }
  }
  return normalizePreferences(null);
}

function writeLocalPreferencesMirror(prefs: SharedUserPreferences): void {
  const serialized = `${JSON.stringify(prefs, null, 2)}\n`;
  const favsSerialized = `${JSON.stringify(prefs.favorites, null, 2)}\n`;
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
      await sql`CREATE SCHEMA IF NOT EXISTS moradia`;
      await sql`
        CREATE TABLE IF NOT EXISTS moradia.user_preferences (
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

export async function loadSharedPreferences(): Promise<SharedUserPreferences> {
  const fallback = loadLocalPreferencesFallback();
  const sql = getSqlClient();
  if (!sql) return fallback;

  try {
    await ensurePreferencesTable();
    const rows = await sql`
      SELECT id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
      FROM moradia.user_preferences
      WHERE id = ${DEFAULT_PREF_ID}
      LIMIT 1
    `;
    if (rows.length > 0) {
      const prefs = normalizePreferences(
        rows[0] as Record<string, unknown>,
        fallback,
      );
      writeLocalPreferencesMirror(prefs);
      return prefs;
    }

    const seededRows = await sql`
      INSERT INTO moradia.user_preferences (
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
    writeLocalPreferencesMirror(seeded);
    return seeded;
  } catch {
    return fallback;
  }
}

export async function saveSharedPreferences(
  partial: Partial<Omit<SharedUserPreferences, "updatedAt">>,
): Promise<SharedUserPreferences> {
  const current = await loadSharedPreferences();
  const nowIso = new Date().toISOString();
  const merged: SharedUserPreferences = {
    filters:
      partial.filters !== undefined &&
      partial.filters !== null &&
      typeof partial.filters === "object" &&
      !Array.isArray(partial.filters)
        ? partial.filters
        : current.filters,
    weights:
      partial.weights !== undefined &&
      partial.weights !== null &&
      typeof partial.weights === "object" &&
      !Array.isArray(partial.weights)
        ? partial.weights
        : current.weights,
    activePresetId:
      typeof partial.activePresetId === "string" && partial.activePresetId.trim()
        ? partial.activePresetId.trim()
        : current.activePresetId,
    favorites: Array.isArray(partial.favorites)
      ? normalizeStringArray(partial.favorites)
      : current.favorites,
    compareKeys: Array.isArray(partial.compareKeys)
      ? normalizeStringArray(partial.compareKeys)
      : current.compareKeys,
    updatedAt: nowIso,
  };

  writeLocalPreferencesMirror(merged);

  const sql = getSqlClient();
  if (!sql) return merged;

  try {
    await ensurePreferencesTable();
    const rows = await sql`
      INSERT INTO moradia.user_preferences (
        id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
      )
      VALUES (
        ${DEFAULT_PREF_ID},
        ${JSON.stringify(merged.filters)}::jsonb,
        ${JSON.stringify(merged.weights)}::jsonb,
        ${merged.activePresetId},
        ${JSON.stringify(merged.favorites)}::jsonb,
        ${JSON.stringify(merged.compareKeys)}::jsonb,
        ${nowIso}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        filters = EXCLUDED.filters,
        weights = EXCLUDED.weights,
        active_preset_id = EXCLUDED.active_preset_id,
        favorites = EXCLUDED.favorites,
        compare_keys = EXCLUDED.compare_keys,
        updated_at = EXCLUDED.updated_at
      RETURNING id, filters, weights, active_preset_id, favorites, compare_keys, updated_at
    `;
    if (rows.length > 0) {
      const saved = normalizePreferences(
        rows[0] as Record<string, unknown>,
        merged,
      );
      writeLocalPreferencesMirror(saved);
      return saved;
    }
  } catch {
    // Return local mirror state if DB write fails transiently
  }
  return merged;
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
