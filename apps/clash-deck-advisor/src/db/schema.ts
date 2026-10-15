import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { AnalysisMode } from "@/lib/engine-context";
import type { BattleOutcome } from "@/lib/types";

export const clashSchema = pgSchema("clash");

export const battles = clashSchema.table(
  "battles",
  {
    id: text("id").primaryKey(),
    playerTag: text("player_tag").notNull(),
    battleTime: text("battle_time").notNull(),
    timestampMs: bigint("timestamp_ms", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    gameModeName: text("game_mode_name").notNull(),
    isLadderOrRanked: boolean("is_ladder_or_ranked").notNull(),
    outcome: text("outcome").$type<BattleOutcome>().notNull(),
    playerCrowns: integer("player_crowns").notNull(),
    opponentCrowns: integer("opponent_crowns").notNull(),
    crownDiff: integer("crown_diff").notNull(),
    trophyChange: integer("trophy_change").notNull(),
    playerDeck: jsonb("player_deck").$type<string[]>().notNull(),
    deckKey: text("deck_key").notNull(),
    opponentName: text("opponent_name").notNull(),
    opponentTag: text("opponent_tag").notNull(),
    opponentDeck: jsonb("opponent_deck").$type<string[]>().notNull(),
    opponentArchetype: text("opponent_archetype").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("clash_battles_player_ts_idx").on(
      table.playerTag,
      table.timestampMs,
    ),
    index("clash_battles_player_deck_idx").on(table.playerTag, table.deckKey),
  ],
);

export const suggestions = clashSchema.table(
  "suggestions",
  {
    id: text("id").primaryKey(),
    playerTag: text("player_tag").notNull(),
    createdAt: text("created_at").notNull(),
    mode: text("mode").$type<AnalysisMode>().notNull(),
    baselineDeck: jsonb("baseline_deck").$type<string[]>().notNull(),
    baselineWinRate: real("baseline_win_rate").notNull(),
    recommendedDeck: jsonb("recommended_deck").$type<string[]>().notNull(),
    recommendedSwaps: jsonb("recommended_swaps")
      .$type<{ out: string; in: string }[]>()
      .notNull(),
    archetypeName: text("archetype_name").notNull(),
  },
  (table) => [
    index("clash_suggestions_player_created_idx").on(
      table.playerTag,
      table.createdAt,
    ),
  ],
);

export const playerPreferences = clashSchema.table("player_preferences", {
  playerTag: text("player_tag").primaryKey(),
  lockedCards: jsonb("locked_cards").$type<string[]>().notNull().default([]),
  excludedCards: jsonb("excluded_cards")
    .$type<string[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
