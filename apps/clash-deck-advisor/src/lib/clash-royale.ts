import "server-only";

import { buildCardProfiles } from "./card-knowledge";
import { selectViableCards } from "./engine-context";
import {
  buildDeckVersions,
  buildLossAutopsy,
  evaluateDeckChangeImpacts,
  lossesFromNormalized,
  normalizeBattles,
} from "./learning-engine";
import type {
  AnalysisContext,
  Battle,
  BattleParticipant,
  MetaDeckReference,
  Player,
  RecentLoss,
  StoredSuggestionEntry,
} from "./types";

export const API_BASE = "https://proxy.royaleapi.dev/v1";
export const PLAYER_TAG = "VGURQ0QQ2";

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

interface RankedPlayer {
  tag: string;
  name: string;
  /** The legacy trophy feed reports trophies, Path of Legend reports Elo. */
  trophies?: number;
  eloRating?: number;
}

interface RankedPlayersResponse {
  items: RankedPlayer[];
}

export type ClashRoyaleErrorCode =
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

interface ApiErrorDetails {
  code: ClashRoyaleErrorCode;
  message: string;
}

function apiErrorDetails(status: number): ApiErrorDetails {
  if (status === 401 || status === 403) {
    return {
      code: "AUTHORIZATION_FAILED",
      message:
        "Clash Royale access was rejected. Check the API token and proxy IP allowlist.",
    };
  }
  if (status === 404) {
    return {
      code: "PLAYER_NOT_FOUND",
      message: "The configured Clash Royale player could not be found.",
    };
  }
  if (status === 429) {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message:
        "Clash Royale is temporarily limiting requests. Try again in a few minutes.",
    };
  }
  if (status === 503) {
    return {
      code: "UPSTREAM_MAINTENANCE",
      message: "Clash Royale is under maintenance. Try again later.",
    };
  }
  if (status >= 500) {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: "Clash Royale is temporarily unavailable. Try again shortly.",
    };
  }
  return {
    code: "UPSTREAM_REQUEST_FAILED",
    message: "Clash Royale rejected the request. Try again shortly.",
  };
}

export class ClashRoyaleApiError extends Error {
  readonly status: number;
  readonly code: ClashRoyaleErrorCode;
  readonly publicMessage: string;

  constructor(status: number) {
    const details = apiErrorDetails(status);
    super(`Clash Royale API request failed with status ${status}`);
    this.name = "ClashRoyaleApiError";
    this.status = status;
    this.code = details.code;
    this.publicMessage = details.message;
  }
}

export class ClashRoyaleNetworkError extends Error {
  readonly publicMessage =
    "The Clash Royale service could not be reached. Try again shortly.";

  constructor() {
    super("Clash Royale API network request failed");
    this.name = "ClashRoyaleNetworkError";
  }
}

function encodedTag(tag: string): string {
  return `%23${encodeURIComponent(tag.replace(/^#/, ""))}`;
}

export async function clashFetch<T>(
  path: string,
  init: NextFetchInit = {},
): Promise<T> {
  const apiKey = process.env.CLASH_ROYALE_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingConfigurationError("CLASH_ROYALE_API_KEY");
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
    throw new ClashRoyaleNetworkError();
  }

  if (!response.ok) {
    throw new ClashRoyaleApiError(response.status);
  }

  return (await response.json()) as T;
}

export async function getPlayer(): Promise<Player> {
  return clashFetch<Player>(`/players/${encodedTag(PLAYER_TAG)}`, {
    next: { revalidate: 300 },
  });
}

export async function getBattleLog(): Promise<Battle[]> {
  return clashFetch<Battle[]>(`/players/${encodedTag(PLAYER_TAG)}/battlelog`, {
    next: { revalidate: 300 },
  });
}

function participantForTag(
  participants: BattleParticipant[],
  tag: string,
): BattleParticipant | undefined {
  const normalizedTag = tag.replace(/^#/, "").toUpperCase();
  return participants.find(
    (participant) =>
      participant.tag.replace(/^#/, "").toUpperCase() === normalizedTag,
  );
}

export function compactRecentLosses(
  battles: Battle[],
  playerTag = PLAYER_TAG,
): RecentLoss[] {
  return battles
    .flatMap((battle): RecentLoss[] => {
      const player =
        participantForTag(battle.team, playerTag) ??
        participantForTag(battle.opponent, playerTag);
      if (!player) {
        return [];
      }

      const playerIsOnTeam = battle.team.includes(player);
      const opponents = playerIsOnTeam ? battle.opponent : battle.team;
      const opponent = opponents[0];

      if (!opponent || player.crowns >= opponent.crowns) {
        return [];
      }

      return [
        {
          battleTime: battle.battleTime,
          opponentName: opponent.name,
          opponentCrowns: opponent.crowns,
          playerCrowns: player.crowns,
          opponentDeck: opponent.cards.map((card) => card.name),
        },
      ];
    })
    .slice(0, 6);
}

function winningDeckForPlayer(
  battles: Battle[],
  rankedPlayer: RankedPlayer,
): MetaDeckReference | null {
  for (const battle of battles) {
    const player =
      participantForTag(battle.team, rankedPlayer.tag) ??
      participantForTag(battle.opponent, rankedPlayer.tag);
    if (!player) {
      continue;
    }

    const playerIsOnTeam = battle.team.includes(player);
    const opponents = playerIsOnTeam ? battle.opponent : battle.team;
    const opponentCrowns = Math.max(
      ...opponents.map((opponent) => opponent.crowns),
      0,
    );

    if (player.crowns > opponentCrowns && player.cards.length === 8) {
      return {
        playerTag: rankedPlayer.tag,
        playerName: rankedPlayer.name,
        rating: rankedPlayer.trophies ?? rankedPlayer.eloRating ?? 0,
        deck: player.cards.map((card) => card.name),
      };
    }
  }

  return null;
}

/**
 * Top-player feeds, most reliable first.
 *
 * The legacy trophy ranking endpoint still returns HTTP 200 but with an empty
 * item list, which silently starved the analysis of meta evidence. Path of
 * Legend is the feed that actually carries data now.
 */
const TOP_PLAYER_ENDPOINTS = [
  "/locations/global/pathoflegend/players",
  "/locations/global/rankings/players",
] as const;

async function fetchTopPlayers(limit: number): Promise<RankedPlayer[]> {
  for (const endpoint of TOP_PLAYER_ENDPOINTS) {
    try {
      const response = await clashFetch<RankedPlayersResponse>(
        `${endpoint}?limit=${limit}`,
        { next: { revalidate: 1_800 } },
      );
      if (response.items.length > 0) {
        return response.items;
      }
    } catch {
      // Try the next feed rather than losing meta evidence entirely.
    }
  }
  return [];
}

export async function getTopLadderMeta(
  limit = 10,
): Promise<MetaDeckReference[]> {
  const topPlayers = await fetchTopPlayers(Math.min(limit, 10));

  const results = await Promise.allSettled(
    topPlayers.slice(0, 10).map(async (rankedPlayer) => {
      const battles = await clashFetch<Battle[]>(
        `/players/${encodedTag(rankedPlayer.tag)}/battlelog`,
        { next: { revalidate: 1_800 } },
      );
      return winningDeckForPlayer(battles, rankedPlayer);
    }),
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

export async function getAnalysisContext(
  suggestionHistory: StoredSuggestionEntry[] = [],
): Promise<AnalysisContext> {
  const [player, battles] = await Promise.all([getPlayer(), getBattleLog()]);

  let metaDecks: MetaDeckReference[] = [];
  try {
    metaDecks = await getTopLadderMeta();
  } catch {
    // Meta is supporting evidence. Player data remains useful if this fails.
  }

  const currentDeckProfiles = buildCardProfiles(player.currentDeck);
  const ownedProfiles = buildCardProfiles(player.cards);
  const viableProfiles = selectViableCards(ownedProfiles, currentDeckProfiles);
  const currentDeckNames = player.currentDeck.map((card) => card.name);

  const normalizedBattles = normalizeBattles(battles, player.tag);
  const recentLosses = lossesFromNormalized(normalizedBattles, 6);
  const lossAutopsy = buildLossAutopsy(
    normalizedBattles,
    currentDeckProfiles,
    viableProfiles,
  );
  const deckVersions = buildDeckVersions(normalizedBattles, currentDeckNames);
  const changeImpacts = evaluateDeckChangeImpacts(
    deckVersions,
    suggestionHistory,
    currentDeckNames,
  );

  return {
    player,
    recentLosses,
    metaDecks,
    metaAvailable: metaDecks.length > 0,
    normalizedBattles,
    lossAutopsy,
    deckVersions,
    changeImpacts,
  };
}
