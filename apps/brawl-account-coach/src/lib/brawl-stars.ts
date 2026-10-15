import "server-only";

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

export const API_BASE = "https://bsproxy.royaleapi.dev/v1";
export const PLAYER_TAG = "Y0GLCU0GL";

const API_REVALIDATE_SECONDS = 30 * 60;

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export type BrawlStarsErrorCode =
  | "AUTHORIZATION_FAILED"
  | "PLAYER_NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_MAINTENANCE"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_REQUEST_FAILED";

export class MissingConfigurationError extends Error {
  readonly variableName: string;

  constructor(variableName: string) {
    super(`Missing required server configuration: ${variableName}`);
    this.name = "MissingConfigurationError";
    this.variableName = variableName;
  }
}

export class BrawlStarsApiError extends Error {
  readonly status: number;
  readonly code: BrawlStarsErrorCode;
  readonly publicMessage: string;

  constructor(status: number) {
    const details = apiErrorDetails(status);
    super(`Brawl Stars API request failed with status ${status}`);
    this.name = "BrawlStarsApiError";
    this.status = status;
    this.code = details.code;
    this.publicMessage = details.message;
  }
}

export class BrawlStarsNetworkError extends Error {
  readonly publicMessage =
    "The Brawl Stars service could not be reached. Try again shortly.";

  constructor() {
    super("Brawl Stars API network request failed");
    this.name = "BrawlStarsNetworkError";
  }
}

interface ApiErrorDetails {
  code: BrawlStarsErrorCode;
  message: string;
}

function apiErrorDetails(status: number): ApiErrorDetails {
  if (status === 401 || status === 403) {
    return {
      code: "AUTHORIZATION_FAILED",
      message:
        "Brawl Stars access was rejected. Check the API token and proxy IP allowlist.",
    };
  }
  if (status === 404) {
    return {
      code: "PLAYER_NOT_FOUND",
      message: "The configured Brawl Stars player could not be found.",
    };
  }
  if (status === 429) {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message:
        "Brawl Stars is temporarily limiting requests. Try again in a few minutes.",
    };
  }
  if (status === 503) {
    return {
      code: "UPSTREAM_MAINTENANCE",
      message: "Brawl Stars is under maintenance. Try again later.",
    };
  }
  if (status >= 500) {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: "Brawl Stars is temporarily unavailable. Try again shortly.",
    };
  }
  return {
    code: "UPSTREAM_REQUEST_FAILED",
    message: "Brawl Stars rejected the request. Try again shortly.",
  };
}

function encodedTag(tag: string): string {
  return encodeURIComponent(`#${tag.replace(/^#/, "")}`);
}

export async function brawlFetch<T>(
  path: string,
  init: NextFetchInit = {},
): Promise<T> {
  const apiKey = process.env.BRAWL_STARS_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingConfigurationError("BRAWL_STARS_API_KEY");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${apiKey}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new BrawlStarsNetworkError();
  }

  if (!response.ok) {
    throw new BrawlStarsApiError(response.status);
  }

  return (await response.json()) as T;
}

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

export async function getPlayerProfile(): Promise<PlayerProfile> {
  const player = await brawlFetch<PlayerProfile>(
    `/players/${encodedTag(PLAYER_TAG)}`,
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

export async function getBattleLog(): Promise<BattleLog> {
  const battleLog = await brawlFetch<BattleLog>(
    `/players/${encodedTag(PLAYER_TAG)}/battlelog`,
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

export async function getAnalysisContext(): Promise<AnalysisContext> {
  const startedAt = Date.now();
  const [player, battleLog, catalog] = await Promise.all([
    getPlayerProfile(),
    getBattleLog(),
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
