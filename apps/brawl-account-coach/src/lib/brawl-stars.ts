import "server-only";

import {
  createSupercellFetcher,
  encodedTag,
  MissingConfigurationError,
  normalizePlayerTag,
  SupercellApiError,
  SupercellNetworkError,
  type SupercellErrorCode,
} from "@data-projects/shared/supercell";

import { deriveAccountMetrics } from "./account-metrics";
import type {
  AnalysisContext,
  BattleLog,
  BrawlerCatalog,
  BrawlerCatalogItem,
  NamedItem,
  PlayerBrawler,
  PlayerProfile,
} from "./types";

export {
  encodedTag,
  MissingConfigurationError,
  normalizePlayerTag,
  SupercellApiError as BrawlStarsApiError,
  SupercellNetworkError as BrawlStarsNetworkError,
  type SupercellErrorCode as BrawlStarsErrorCode,
};

export const API_BASE = "https://bsproxy.royaleapi.dev/v1";
export const PLAYER_TAG = "Y0GLCU0GL";

const API_REVALIDATE_SECONDS = 30 * 60;

export const brawlFetch = createSupercellFetcher({
  serviceName: "Brawl Stars",
  baseUrl: API_BASE,
  apiKeyEnvVar: "BRAWL_STARS_API_KEY",
});

function normalizeItems(items: NamedItem[] | undefined): NamedItem[] {
  return items ?? [];
}

function normalizePlayerBrawler(brawler: PlayerBrawler): PlayerBrawler {
  return {
    ...brawler,
    gadgets: normalizeItems(brawler.gadgets),
    starPowers: normalizeItems(brawler.starPowers),
    gears: brawler.gears ?? [],
    hyperCharges: normalizeItems(brawler.hyperCharges),
  };
}

function normalizeCatalogBrawler(
  brawler: BrawlerCatalogItem,
): BrawlerCatalogItem {
  return {
    ...brawler,
    gadgets: normalizeItems(brawler.gadgets),
    starPowers: normalizeItems(brawler.starPowers),
    gears: normalizeItems(brawler.gears),
    hyperCharges: normalizeItems(brawler.hyperCharges),
  };
}

export async function getPlayerProfile(
  tag = PLAYER_TAG,
): Promise<PlayerProfile> {
  const player = await brawlFetch<PlayerProfile>(
    `/players/${encodedTag(tag)}`,
    {
      next: {
        revalidate: API_REVALIDATE_SECONDS,
        tags: ["brawl-account-coach-player"],
      },
    },
  );
  return {
    ...player,
    brawlers: (player.brawlers ?? []).map(normalizePlayerBrawler),
  };
}

export async function getBattleLog(tag = PLAYER_TAG): Promise<BattleLog> {
  const battleLog = await brawlFetch<BattleLog>(
    `/players/${encodedTag(tag)}/battlelog`,
    {
      next: {
        revalidate: API_REVALIDATE_SECONDS,
        tags: ["brawl-account-coach-battles"],
      },
    },
  );
  return {
    items: battleLog.items ?? [],
  };
}

export async function getBrawlerCatalog(): Promise<BrawlerCatalogItem[]> {
  const catalog = await brawlFetch<BrawlerCatalog>("/brawlers", {
    next: {
      revalidate: API_REVALIDATE_SECONDS,
      tags: ["brawl-account-coach-catalog"],
    },
  });
  return (catalog.items ?? []).map(normalizeCatalogBrawler);
}

export async function getAnalysisContext(
  tag = PLAYER_TAG,
): Promise<AnalysisContext> {
  const startedAt = Date.now();
  const [player, battleLog, catalog] = await Promise.all([
    getPlayerProfile(tag),
    getBattleLog(tag),
    getBrawlerCatalog(),
  ]);
  const metrics = deriveAccountMetrics(player, battleLog, catalog);

  console.info("[brawl-account-coach] loaded account context", {
    durationMs: Date.now() - startedAt,
    ownedBrawlers: player.brawlers.length,
    catalogBrawlers: catalog.length,
    recentBattles: battleLog.items.length,
  });

  return {
    player,
    battleLog,
    catalog,
    metrics,
  };
}
