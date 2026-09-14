import "server-only";

import type {
  AnalysisContext,
  Battle,
  BattleParticipant,
  MetaDeckReference,
  Player,
  RecentLoss,
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
  trophies: number;
}

interface RankedPlayersResponse {
  items: RankedPlayer[];
}

export class MissingConfigurationError extends Error {
  constructor(variableName: string) {
    super(`Missing required server configuration: ${variableName}`);
    this.name = "MissingConfigurationError";
  }
}

export class ClashRoyaleApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Clash Royale API request failed with status ${status}`);
    this.name = "ClashRoyaleApiError";
    this.status = status;
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

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

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
        trophies: rankedPlayer.trophies,
        deck: player.cards.map((card) => card.name),
      };
    }
  }

  return null;
}

export async function getTopLadderMeta(
  limit = 10,
): Promise<MetaDeckReference[]> {
  const rankings = await clashFetch<RankedPlayersResponse>(
    `/locations/global/rankings/players?limit=${Math.min(limit, 10)}`,
    { next: { revalidate: 1_800 } },
  );

  const results = await Promise.allSettled(
    rankings.items.slice(0, 10).map(async (rankedPlayer) => {
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

export async function getAnalysisContext(): Promise<AnalysisContext> {
  const [player, battles] = await Promise.all([getPlayer(), getBattleLog()]);

  let metaDecks: MetaDeckReference[] = [];
  try {
    metaDecks = await getTopLadderMeta();
  } catch {
    // Meta is supporting evidence. Player data remains useful if this fails.
  }

  return {
    player,
    recentLosses: compactRecentLosses(battles, player.tag),
    metaDecks,
    metaAvailable: metaDecks.length > 0,
  };
}
