import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { battles, playerPreferences, suggestions } from "@/db/schema";

import { mergeBattleHistory } from "./battle-history";
import type { NormalizedBattle, StoredSuggestionEntry } from "./types";

export const MAX_DB_BATTLES = 500;

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").toUpperCase();
}

export function battleRowId(
  playerTag: string,
  battle: { battleTime: string; opponentTag: string },
): string {
  return `${normalizeTag(playerTag)}:${battle.battleTime}:${normalizeTag(battle.opponentTag)}`;
}

export async function syncAndLoadBattles(
  playerTag: string,
  incomingBattles: NormalizedBattle[],
  limit = MAX_DB_BATTLES,
): Promise<NormalizedBattle[]> {
  const db = getDb();
  if (!db) {
    return incomingBattles;
  }

  const cleanTag = normalizeTag(playerTag);

  try {
    const validIncoming = incomingBattles.filter(
      (b) => b.timestampMs > 0 && b.playerDeck.length === 8,
    );

    if (validIncoming.length > 0) {
      const rows = validIncoming.map((b) => ({
        id: battleRowId(cleanTag, b),
        playerTag: cleanTag,
        battleTime: b.battleTime,
        timestampMs: b.timestampMs,
        type: b.type,
        gameModeName: b.gameModeName,
        isLadderOrRanked: b.isLadderOrRanked,
        outcome: b.outcome,
        playerCrowns: b.playerCrowns,
        opponentCrowns: b.opponentCrowns,
        crownDiff: b.crownDiff,
        trophyChange: b.trophyChange,
        playerDeck: b.playerDeck,
        deckKey: b.deckKey,
        opponentName: b.opponentName,
        opponentTag: b.opponentTag,
        opponentDeck: b.opponentDeck,
        opponentArchetype: b.opponentArchetype,
      }));

      await db.insert(battles).values(rows).onConflictDoNothing();
    }

    const storedRows = await db
      .select()
      .from(battles)
      .where(eq(battles.playerTag, cleanTag))
      .orderBy(desc(battles.timestampMs))
      .limit(limit);

    const fromDb: NormalizedBattle[] = storedRows.map((row) => ({
      battleTime: row.battleTime,
      timestampMs: row.timestampMs,
      type: row.type,
      gameModeName: row.gameModeName,
      isLadderOrRanked: row.isLadderOrRanked,
      outcome: row.outcome,
      playerCrowns: row.playerCrowns,
      opponentCrowns: row.opponentCrowns,
      crownDiff: row.crownDiff,
      trophyChange: row.trophyChange,
      playerDeck: row.playerDeck,
      deckKey: row.deckKey,
      opponentName: row.opponentName,
      opponentTag: row.opponentTag,
      opponentDeck: row.opponentDeck,
      opponentArchetype: row.opponentArchetype,
    }));

    return mergeBattleHistory([incomingBattles, fromDb], limit);
  } catch (error) {
    console.warn("[clash-deck-advisor] failed to sync battles with Neon DB", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return incomingBattles;
  }
}

export async function loadStoredSuggestions(
  playerTag: string,
  limit = 25,
): Promise<StoredSuggestionEntry[]> {
  const db = getDb();
  if (!db) {
    return [];
  }

  const cleanTag = normalizeTag(playerTag);

  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.playerTag, cleanTag))
      .orderBy(desc(suggestions.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      mode: row.mode,
      baselineDeck: row.baselineDeck,
      baselineWinRate: row.baselineWinRate,
      recommendedDeck: row.recommendedDeck,
      recommendedSwaps: row.recommendedSwaps,
      archetypeName: row.archetypeName,
    }));
  } catch (error) {
    console.warn("[clash-deck-advisor] failed to load suggestions from DB", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function saveSuggestionEntry(
  playerTag: string,
  entry: StoredSuggestionEntry,
): Promise<void> {
  const db = getDb();
  if (!db) {
    return;
  }

  const cleanTag = normalizeTag(playerTag);

  try {
    await db
      .insert(suggestions)
      .values({
        id: entry.id,
        playerTag: cleanTag,
        createdAt: entry.createdAt,
        mode: entry.mode,
        baselineDeck: entry.baselineDeck,
        baselineWinRate: entry.baselineWinRate,
        recommendedDeck: entry.recommendedDeck,
        recommendedSwaps: entry.recommendedSwaps,
        archetypeName: entry.archetypeName,
      })
      .onConflictDoUpdate({
        target: suggestions.id,
        set: {
          createdAt: entry.createdAt,
          baselineDeck: entry.baselineDeck,
          baselineWinRate: entry.baselineWinRate,
          recommendedDeck: entry.recommendedDeck,
          recommendedSwaps: entry.recommendedSwaps,
          archetypeName: entry.archetypeName,
        },
      });
  } catch (error) {
    console.warn("[clash-deck-advisor] failed to save suggestion to DB", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function loadPlayerPreferences(
  playerTag: string,
): Promise<{ lockedCards: string[]; excludedCards: string[] } | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const cleanTag = normalizeTag(playerTag);

  try {
    const rows = await db
      .select()
      .from(playerPreferences)
      .where(eq(playerPreferences.playerTag, cleanTag))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      lockedCards: row.lockedCards,
      excludedCards: row.excludedCards,
    };
  } catch (error) {
    console.warn("[clash-deck-advisor] failed to load preferences from DB", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function savePlayerPreferences(
  playerTag: string,
  prefs: { lockedCards: string[]; excludedCards: string[] },
): Promise<void> {
  const db = getDb();
  if (!db) {
    return;
  }

  const cleanTag = normalizeTag(playerTag);

  try {
    await db
      .insert(playerPreferences)
      .values({
        playerTag: cleanTag,
        lockedCards: prefs.lockedCards,
        excludedCards: prefs.excludedCards,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: playerPreferences.playerTag,
        set: {
          lockedCards: prefs.lockedCards,
          excludedCards: prefs.excludedCards,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[clash-deck-advisor] failed to save preferences to DB", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
