import { z } from "zod";

import { playerPreferencesSchema, type PlayerPreferences } from "./schemas";
import type { AnalysisResponse } from "./types";

export const PROGRESSION_LEDGER_STORAGE_KEY =
  "brawl-account-coach:progression-ledger:v1";

export const MAX_SNAPSHOTS = 30;
export const DEDUP_WINDOW_MS = 15 * 60 * 1_000;

export const snapshotBrawlerSchema = z
  .object({
    id: z.number().int(),
    name: z.string().trim().min(1),
    power: z.number().int().min(1).max(11),
    trophies: z.number().int().min(0),
    highestTrophies: z.number().int().min(0),
    gadgetCount: z.number().int().min(0),
    starPowerCount: z.number().int().min(0),
    gearCount: z.number().int().min(0),
    hyperchargeCount: z.number().int().min(0),
  })
  .strict();

export const accountSnapshotSchema = z
  .object({
    recordedAt: z.string().trim().min(1),
    trophies: z.number().int().min(0),
    highestTrophies: z.number().int().min(0),
    brawlers: z.array(snapshotBrawlerSchema),
    recommendedUpgrades: z.array(z.string().trim().min(1)).default([]),
    recommendedPushes: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type SnapshotBrawler = z.infer<typeof snapshotBrawlerSchema>;
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;

export interface ProgressionLedger extends PlayerPreferences {
  snapshots: AccountSnapshot[];
}

export interface UpgradedBrawlerSummary {
  id: number;
  name: string;
  previousPower: number;
  currentPower: number;
  trophyDelta: number;
  newGadgets: number;
  newStarPowers: number;
  newGears: number;
  newHypercharges: number;
  wasRecommendedUpgrade: boolean;
  label: string;
}

export interface BrawlerTrophyGain {
  id: number;
  name: string;
  previousTrophies: number;
  currentTrophies: number;
  trophyDelta: number;
  currentPower: number;
  wasRecommendedPush: boolean;
  wasRecommendedUpgrade: boolean;
}

export interface ProgressionSummary {
  hasBaseline: boolean;
  baselineRecordedAt: string | null;
  trophyDelta: number;
  highestTrophyDelta: number;
  unlockedBrawlers: string[];
  upgradedBrawlers: UpgradedBrawlerSummary[];
  brawlerTrophyGains: BrawlerTrophyGain[];
  followedRecommendationsCount: number;
  verdict: "gaining" | "steady" | "slipping" | "baseline";
}

function normalizeName(name: string): string {
  return name.trim().toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function emptyProgressionLedger(): ProgressionLedger {
  return {
    snapshots: [],
    pinnedBrawlers: [],
    excludedBrawlers: [],
  };
}

export function parseProgressionLedger(raw: unknown): ProgressionLedger {
  if (!raw || typeof raw !== "object") {
    return emptyProgressionLedger();
  }

  const candidate = raw as {
    snapshots?: unknown;
    pinnedBrawlers?: unknown;
    excludedBrawlers?: unknown;
  };

  const prefsResult = playerPreferencesSchema.safeParse({
    pinnedBrawlers: candidate.pinnedBrawlers ?? [],
    excludedBrawlers: candidate.excludedBrawlers ?? [],
  });

  const rawSnapshots = Array.isArray(candidate.snapshots)
    ? candidate.snapshots
    : [];
  const snapshots: AccountSnapshot[] = [];
  for (const item of rawSnapshots) {
    const parsed = accountSnapshotSchema.safeParse(item);
    if (parsed.success) {
      snapshots.push(parsed.data);
    }
  }

  return {
    snapshots: snapshots.slice(-MAX_SNAPSHOTS),
    pinnedBrawlers: prefsResult.success ? prefsResult.data.pinnedBrawlers : [],
    excludedBrawlers: prefsResult.success
      ? prefsResult.data.excludedBrawlers
      : [],
  };
}

export function loadProgressionLedger(): ProgressionLedger {
  if (typeof window === "undefined") {
    return emptyProgressionLedger();
  }
  try {
    const raw = window.localStorage.getItem(PROGRESSION_LEDGER_STORAGE_KEY);
    return raw ? parseProgressionLedger(JSON.parse(raw)) : emptyProgressionLedger();
  } catch {
    return emptyProgressionLedger();
  }
}

export function saveProgressionLedger(ledger: ProgressionLedger): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      PROGRESSION_LEDGER_STORAGE_KEY,
      JSON.stringify(ledger),
    );
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
}

export function hasPreferences(ledger: PlayerPreferences): boolean {
  return (
    ledger.pinnedBrawlers.length > 0 || ledger.excludedBrawlers.length > 0
  );
}

export function toPreferences(ledger: ProgressionLedger): PlayerPreferences {
  return {
    pinnedBrawlers: ledger.pinnedBrawlers,
    excludedBrawlers: ledger.excludedBrawlers,
  };
}

export function togglePinnedBrawler<T extends PlayerPreferences>(
  state: T,
  brawlerName: string,
): T {
  const key = normalizeName(brawlerName);
  const isPinned = state.pinnedBrawlers.some(
    (item) => normalizeName(item) === key,
  );
  const pinnedBrawlers = isPinned
    ? state.pinnedBrawlers.filter((item) => normalizeName(item) !== key)
    : [...state.pinnedBrawlers, brawlerName].slice(-12);
  const excludedBrawlers = state.excludedBrawlers.filter(
    (item) => normalizeName(item) !== key,
  );

  return {
    ...state,
    pinnedBrawlers,
    excludedBrawlers,
  };
}

export function toggleExcludedBrawler<T extends PlayerPreferences>(
  state: T,
  brawlerName: string,
): T {
  const key = normalizeName(brawlerName);
  const isExcluded = state.excludedBrawlers.some(
    (item) => normalizeName(item) === key,
  );
  const excludedBrawlers = isExcluded
    ? state.excludedBrawlers.filter((item) => normalizeName(item) !== key)
    : [...state.excludedBrawlers, brawlerName].slice(-30);
  const pinnedBrawlers = state.pinnedBrawlers.filter(
    (item) => normalizeName(item) !== key,
  );

  return {
    ...state,
    pinnedBrawlers,
    excludedBrawlers,
  };
}

export function clearBrawlerRules<T extends PlayerPreferences>(state: T): T {
  return {
    ...state,
    pinnedBrawlers: [],
    excludedBrawlers: [],
  };
}

export function createSnapshotFromAnalysis(
  response: AnalysisResponse,
): AccountSnapshot {
  return {
    recordedAt: response.generatedAt,
    trophies: response.player.trophies,
    highestTrophies: response.player.highestTrophies,
    brawlers: response.player.brawlers.map((brawler) => ({
      id: brawler.id,
      name: brawler.name,
      power: brawler.power,
      trophies: brawler.trophies,
      highestTrophies: brawler.highestTrophies,
      gadgetCount: brawler.gadgets.length,
      starPowerCount: brawler.starPowers.length,
      gearCount: brawler.gears.length,
      hyperchargeCount: brawler.hyperCharges.length,
    })),
    recommendedUpgrades: response.analysis.upgradePriorities.map(
      (item) => item.brawlerName,
    ),
    recommendedPushes: response.analysis.pushTargets.map(
      (item) => item.brawlerName,
    ),
  };
}

export function isSameSnapshotState(
  left: AccountSnapshot,
  right: AccountSnapshot,
): boolean {
  if (
    left.trophies !== right.trophies ||
    left.brawlers.length !== right.brawlers.length
  ) {
    return false;
  }

  const leftById = new Map(left.brawlers.map((brawler) => [brawler.id, brawler]));
  for (const brawler of right.brawlers) {
    const match = leftById.get(brawler.id);
    if (
      !match ||
      match.power !== brawler.power ||
      match.trophies !== brawler.trophies ||
      match.gadgetCount !== brawler.gadgetCount ||
      match.starPowerCount !== brawler.starPowerCount ||
      match.gearCount !== brawler.gearCount ||
      match.hyperchargeCount !== brawler.hyperchargeCount
    ) {
      return false;
    }
  }

  return true;
}

function isWithinDedupWindow(firstIso: string, secondIso: string): boolean {
  const firstMs = Date.parse(firstIso);
  const secondMs = Date.parse(secondIso);
  if (Number.isNaN(firstMs) || Number.isNaN(secondMs)) {
    return false;
  }
  return Math.abs(secondMs - firstMs) < DEDUP_WINDOW_MS;
}

function mergeRecommendations(first: string[], second: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...second, ...first]) {
    const key = normalizeName(name);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(name);
    }
  }
  return merged;
}

export function recordSnapshot(
  ledger: ProgressionLedger,
  incoming: AccountSnapshot,
): ProgressionLedger {
  const sorted = [...ledger.snapshots].sort(
    (left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt),
  );

  const latest = sorted.at(-1);
  if (
    latest &&
    (isWithinDedupWindow(latest.recordedAt, incoming.recordedAt) ||
      isSameSnapshotState(latest, incoming))
  ) {
    const merged: AccountSnapshot = {
      ...incoming,
      recordedAt: isSameSnapshotState(latest, incoming)
        ? latest.recordedAt
        : incoming.recordedAt,
      recommendedUpgrades: mergeRecommendations(
        latest.recommendedUpgrades,
        incoming.recommendedUpgrades,
      ),
      recommendedPushes: mergeRecommendations(
        latest.recommendedPushes,
        incoming.recommendedPushes,
      ),
    };
    return {
      ...ledger,
      snapshots: [...sorted.slice(0, -1), merged].slice(-MAX_SNAPSHOTS),
    };
  }

  return {
    ...ledger,
    snapshots: [...sorted, incoming].slice(-MAX_SNAPSHOTS),
  };
}

export function recordAnalysisInLedger(
  ledger: ProgressionLedger,
  response: AnalysisResponse,
): ProgressionLedger {
  return recordSnapshot(ledger, createSnapshotFromAnalysis(response));
}

export function computeProgressionSummary(
  snapshots: AccountSnapshot[],
  currentSnapshot: AccountSnapshot,
): ProgressionSummary {
  const sortedNewestFirst = [...snapshots].sort(
    (left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
  );

  const changedBaseline = sortedNewestFirst.find(
    (snapshot) => !isSameSnapshotState(snapshot, currentSnapshot),
  );
  const fallbackBaseline = sortedNewestFirst.find(
    (snapshot) =>
      snapshot.recordedAt !== currentSnapshot.recordedAt &&
      !isWithinDedupWindow(snapshot.recordedAt, currentSnapshot.recordedAt),
  );
  const baseline = changedBaseline ?? fallbackBaseline ?? null;

  if (!baseline) {
    return {
      hasBaseline: false,
      baselineRecordedAt: null,
      trophyDelta: 0,
      highestTrophyDelta: 0,
      unlockedBrawlers: [],
      upgradedBrawlers: [],
      brawlerTrophyGains: [],
      followedRecommendationsCount: 0,
      verdict: "baseline",
    };
  }

  const trophyDelta = currentSnapshot.trophies - baseline.trophies;
  const highestTrophyDelta =
    currentSnapshot.highestTrophies - baseline.highestTrophies;

  const prevById = new Map(
    baseline.brawlers.map((brawler) => [brawler.id, brawler]),
  );
  const prevByName = new Map(
    baseline.brawlers.map((brawler) => [normalizeName(brawler.name), brawler]),
  );

  const recUpgradeKeys = new Set(
    baseline.recommendedUpgrades.map((name) => normalizeName(name)),
  );
  const recPushKeys = new Set(
    baseline.recommendedPushes.map((name) => normalizeName(name)),
  );

  const unlockedBrawlers: string[] = [];
  const upgradedBrawlers: UpgradedBrawlerSummary[] = [];
  const brawlerTrophyGains: BrawlerTrophyGain[] = [];

  for (const current of currentSnapshot.brawlers) {
    const key = normalizeName(current.name);
    const prev = prevById.get(current.id) ?? prevByName.get(key);

    if (!prev) {
      unlockedBrawlers.push(current.name);
      continue;
    }

    const powerGain = current.power - prev.power;
    const newGadgets = Math.max(0, current.gadgetCount - prev.gadgetCount);
    const newStarPowers = Math.max(
      0,
      current.starPowerCount - prev.starPowerCount,
    );
    const newGears = Math.max(0, current.gearCount - prev.gearCount);
    const newHypercharges = Math.max(
      0,
      current.hyperchargeCount - prev.hyperchargeCount,
    );
    const brawlerDelta = current.trophies - prev.trophies;
    const wasRecommendedUpgrade = recUpgradeKeys.has(key);
    const wasRecommendedPush = recPushKeys.has(key);

    if (
      powerGain > 0 ||
      newGadgets > 0 ||
      newStarPowers > 0 ||
      newGears > 0 ||
      newHypercharges > 0
    ) {
      const powerPart =
        powerGain > 0
          ? `P${prev.power} → P${current.power}`
          : `P${current.power} loadout`;
      upgradedBrawlers.push({
        id: current.id,
        name: current.name,
        previousPower: prev.power,
        currentPower: current.power,
        trophyDelta: brawlerDelta,
        newGadgets,
        newStarPowers,
        newGears,
        newHypercharges,
        wasRecommendedUpgrade,
        label: `${current.name} ${powerPart}`,
      });
    }

    if (brawlerDelta !== 0) {
      brawlerTrophyGains.push({
        id: current.id,
        name: current.name,
        previousTrophies: prev.trophies,
        currentTrophies: current.trophies,
        trophyDelta: brawlerDelta,
        currentPower: current.power,
        wasRecommendedPush,
        wasRecommendedUpgrade,
      });
    }
  }

  upgradedBrawlers.sort(
    (left, right) =>
      Number(right.wasRecommendedUpgrade) - Number(left.wasRecommendedUpgrade) ||
      right.currentPower -
        right.previousPower -
        (left.currentPower - left.previousPower) ||
      right.trophyDelta - left.trophyDelta ||
      left.name.localeCompare(right.name),
  );

  brawlerTrophyGains.sort(
    (left, right) =>
      right.trophyDelta - left.trophyDelta ||
      Math.abs(right.trophyDelta) - Math.abs(left.trophyDelta) ||
      left.name.localeCompare(right.name),
  );

  const followedNames = new Set<string>();
  for (const item of upgradedBrawlers) {
    if (item.wasRecommendedUpgrade) {
      followedNames.add(normalizeName(item.name));
    }
  }
  for (const item of brawlerTrophyGains) {
    if (
      item.trophyDelta > 0 &&
      (item.wasRecommendedPush || item.wasRecommendedUpgrade)
    ) {
      followedNames.add(normalizeName(item.name));
    }
  }

  const verdict: ProgressionSummary["verdict"] =
    trophyDelta > 0 || upgradedBrawlers.length > 0
      ? "gaining"
      : trophyDelta < 0
        ? "slipping"
        : "steady";

  return {
    hasBaseline: true,
    baselineRecordedAt: baseline.recordedAt,
    trophyDelta,
    highestTrophyDelta,
    unlockedBrawlers,
    upgradedBrawlers,
    brawlerTrophyGains: brawlerTrophyGains.slice(0, 6),
    followedRecommendationsCount: followedNames.size,
    verdict,
  };
}
