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

import {
  battleIdentity,
  fromStoredBattle,
  mergeBattleHistory,
  RECENT_BATTLE_WINDOW,
} from "./battle-history";
import { buildCardProfiles } from "./card-knowledge";
import { MAX_DB_BATTLES, syncAndLoadBattles } from "./db-store";
import { selectViableCards } from "./engine-context";
import {
  buildDeckVersions,
  buildLossAutopsy,
  deckKeyOf,
  evaluateDeckChangeImpacts,
  lossesFromNormalized,
  normalizeBattles,
} from "./learning-engine";
import type { StoredBattle } from "./schemas";
import type {
  AnalysisContext,
  Battle,
  BattleParticipant,
  MetaDeckReference,
  Player,
  StoredSuggestionEntry,
} from "./types";

export {
  encodedTag,
  MissingConfigurationError,
  normalizePlayerTag,
  SupercellApiError as ClashRoyaleApiError,
  SupercellNetworkError as ClashRoyaleNetworkError,
  type SupercellErrorCode as ClashRoyaleErrorCode,
};

export const API_BASE = "https://proxy.royaleapi.dev/v1";
export const PLAYER_TAG = "VGURQ0QQ2";

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

export const clashFetch = createSupercellFetcher({
  serviceName: "Clash Royale",
  baseUrl: API_BASE,
  apiKeyEnvVar: "CLASH_ROYALE_API_KEY",
});

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

/**
 * The live battle log only reaches back about 25 battles, so the browser's
 * saved history is merged in to let deck versions and before/after impacts
 * see further back. Form and loss analysis stay on the newest battles.
 */
export async function getAnalysisContext({
  suggestionHistory = [],
  storedBattles = [],
}: {
  suggestionHistory?: StoredSuggestionEntry[];
  storedBattles?: StoredBattle[];
} = {}): Promise<AnalysisContext> {
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

  const freshBattles = normalizeBattles(battles, player.tag);
  const incomingBattles = mergeBattleHistory(
    [freshBattles, storedBattles.map(fromStoredBattle)],
    MAX_DB_BATTLES,
  );
  const normalizedBattles = await syncAndLoadBattles(
    player.tag,
    incomingBattles,
    MAX_DB_BATTLES,
  );
  const recentBattles = normalizedBattles.slice(0, RECENT_BATTLE_WINDOW);
  const currentDeckKey = deckKeyOf(currentDeckNames);
  const currentDeckBattles = normalizedBattles.filter(
    (b) => b.deckKey === currentDeckKey,
  );
  const recentLosses = lossesFromNormalized(currentDeckBattles, 6);
  const lossAutopsy = buildLossAutopsy(
    recentBattles,
    currentDeckProfiles,
    viableProfiles,
  );
  const deckVersions = buildDeckVersions(normalizedBattles, currentDeckNames);
  const changeImpacts = evaluateDeckChangeImpacts(
    deckVersions,
    suggestionHistory,
    currentDeckNames,
  );

  const freshIdentities = new Set(freshBattles.map(battleIdentity));
  const fromBattleLog = normalizedBattles.filter((battle) =>
    freshIdentities.has(battleIdentity(battle)),
  ).length;

  return {
    player,
    recentLosses,
    metaDecks,
    metaAvailable: metaDecks.length > 0,
    normalizedBattles,
    freshBattles,
    historyStats: {
      battlesTracked: normalizedBattles.length,
      fromBattleLog,
      fromBrowser: normalizedBattles.length - fromBattleLog,
      oldestBattleTime: normalizedBattles.at(-1)?.battleTime ?? null,
    },
    lossAutopsy,
    deckVersions,
    changeImpacts,
  };
}
