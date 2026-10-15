import {
  battleOutcome,
  classifyOpponentArchetype,
  deckKeyOf,
  isLadderOrRankedMode,
  parseClashBattleTime,
} from "./learning-engine";
import { MAX_STORED_BATTLES, type StoredBattle } from "./schemas";
import type { NormalizedBattle } from "./types";

/** How many of the newest battles count as "right now" for form and loss analysis. */
export const RECENT_BATTLE_WINDOW = 25;

interface BattleIdentityFields {
  battleTime: string;
  opponentTag: string;
}

export function battleIdentity(battle: BattleIdentityFields): string {
  const tag = battle.opponentTag.replace(/^#/, "").toUpperCase();
  return `${battle.battleTime}|${tag}`;
}

export function toStoredBattle(battle: NormalizedBattle): StoredBattle {
  return {
    battleTime: battle.battleTime,
    type: battle.type,
    gameModeName: battle.gameModeName,
    playerCrowns: battle.playerCrowns,
    opponentCrowns: battle.opponentCrowns,
    trophyChange: battle.trophyChange,
    playerDeck: [...battle.playerDeck],
    opponentName: battle.opponentName,
    opponentTag: battle.opponentTag,
    opponentDeck: [...battle.opponentDeck],
  };
}

export function fromStoredBattle(battle: StoredBattle): NormalizedBattle {
  return {
    battleTime: battle.battleTime,
    timestampMs: parseClashBattleTime(battle.battleTime),
    type: battle.type,
    gameModeName: battle.gameModeName,
    isLadderOrRanked: isLadderOrRankedMode(battle.type, battle.gameModeName),
    outcome: battleOutcome(battle.playerCrowns, battle.opponentCrowns),
    playerCrowns: battle.playerCrowns,
    opponentCrowns: battle.opponentCrowns,
    crownDiff: battle.playerCrowns - battle.opponentCrowns,
    trophyChange: battle.trophyChange,
    playerDeck: [...battle.playerDeck],
    deckKey: deckKeyOf(battle.playerDeck),
    opponentName: battle.opponentName,
    opponentTag: battle.opponentTag,
    opponentDeck: [...battle.opponentDeck],
    opponentArchetype: classifyOpponentArchetype(battle.opponentDeck),
  };
}

/**
 * Merges battle lists newest first, keeping one copy of each battle and
 * dropping entries without a readable timestamp. Earlier lists win on
 * duplicates, so pass the live battle log first.
 */
export function mergeBattleHistory<T extends BattleIdentityFields>(
  lists: T[][],
  limit = MAX_STORED_BATTLES,
): T[] {
  const seen = new Set<string>();
  const merged: { battle: T; timestampMs: number; order: number }[] = [];

  for (const list of lists) {
    for (const battle of list) {
      const timestampMs = parseClashBattleTime(battle.battleTime);
      const identity = battleIdentity(battle);
      if (timestampMs === 0 || seen.has(identity)) continue;
      seen.add(identity);
      merged.push({ battle, timestampMs, order: merged.length });
    }
  }

  return merged
    .sort(
      (left, right) =>
        right.timestampMs - left.timestampMs || left.order - right.order,
    )
    .slice(0, limit)
    .map(({ battle }) => battle);
}
