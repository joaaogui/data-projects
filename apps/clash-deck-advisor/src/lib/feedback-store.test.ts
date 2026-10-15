import { describe, expect, it } from "vitest";

import {
  buildSuggestionEntry,
  emptyLedger,
  hasLedgerData,
  parseLedger,
  recordAnalysis,
  toFeedbackInput,
  toggleExcludedCard,
  toggleLockedCard,
  type LearningLedger,
} from "./feedback-store";
import type { DeckAnalysis, StoredBattle } from "./schemas";
import type { AnalysisResponse } from "./types";

const CURRENT = [
  "Knight",
  "Archers",
  "Fireball",
  "The Log",
  "Hog Rider",
  "Minion Horde",
  "Ice Spirit",
  "Cannon",
];
const IMPROVED = CURRENT.map((card) =>
  card === "Minion Horde" ? "Musketeer" : card,
);

function battle(battleTime: string, opponentTag = "#OPP1"): StoredBattle {
  return {
    battleTime,
    type: "PvP",
    gameModeName: "Ladder",
    playerCrowns: 1,
    opponentCrowns: 0,
    trophyChange: 30,
    playerDeck: CURRENT,
    opponentName: "Rival",
    opponentTag,
    opponentDeck: CURRENT,
  };
}

function response(overrides: {
  changes?: DeckAnalysis["changes"];
  battleLog?: StoredBattle[];
}): AnalysisResponse {
  const changes = overrides.changes ?? [
    { out: "Minion Horde", in: "Musketeer", reason: "Steadier air defense." },
  ];
  return {
    analysis: {
      originalDeck: CURRENT,
      improvedDeck: changes.length > 0 ? IMPROVED : CURRENT,
      verdict: changes.length > 0 ? "improve" : "keep",
      verdictReason: "Measured against recent losses.",
      problems: [],
      changes,
      metaTier: { archetype: "Hog Cycle", tier: "A", summary: "Fast cycle." },
      matchups: [],
      replayAdvice: [],
      weaknessScores: {
        airDefense: 50,
        tankStopping: 50,
        swarmControl: 50,
        spellCoverage: 50,
        cycle: 50,
        synergy: 50,
      },
      strategy: "Cycle Hog Rider behind Ice Spirit.",
      averageElixir: 3,
    },
    player: {
      tag: "#VGURQ0QQ2",
      name: "Player",
      trophies: 7000,
      wins: 10,
      losses: 10,
      battleCount: 20,
      arena: { id: 1, name: "Arena" },
      currentDeck: [],
      cards: [],
    },
    levelWarnings: [],
    generatedAt: "2026-09-19T12:00:00.000Z",
    metaAvailable: false,
    mode: "improve",
    lossAutopsy: {
      totalBattlesAnalyzed: 20,
      recentWins: 8,
      recentLosses: 12,
      recentDraws: 0,
      recentWinRate: 40,
      netTrophies: -60,
      currentStreak: { type: "loss", count: 2 },
      threeCrownLosses: 1,
      oneCrownLosses: 5,
      topThreatCards: [],
      topThreatArchetypes: [],
      dominantBlindSpots: [],
    },
    deckVersions: [],
    changeImpacts: [],
    appliedFeedback: { lockedCards: [], excludedCards: [], penalizedDecks: [] },
    battleLog: overrides.battleLog ?? [],
    historyStats: {
      battlesTracked: 20,
      fromBattleLog: 20,
      fromBrowser: 0,
      oldestBattleTime: null,
    },
  };
}

describe("feedback-store ledger", () => {
  it("reads a ledger saved before battle history existed", () => {
    const ledger = parseLedger({
      lockedCards: ["Knight"],
      excludedCards: [],
      suggestionHistory: [],
    });
    expect(ledger.lockedCards).toEqual(["Knight"]);
    expect(ledger.battleHistory).toEqual([]);
  });

  it("keeps card rules when the saved battles are corrupt, and the reverse", () => {
    const corruptBattles = parseLedger({
      lockedCards: ["Knight"],
      excludedCards: ["Archers"],
      suggestionHistory: [],
      battleHistory: [{ battleTime: "x" }],
    });
    expect(corruptBattles.lockedCards).toEqual(["Knight"]);
    expect(corruptBattles.excludedCards).toEqual(["Archers"]);
    expect(corruptBattles.battleHistory).toEqual([]);

    const corruptRules = parseLedger({
      lockedCards: "Knight",
      battleHistory: [battle("20260919T100000.000Z")],
    });
    expect(corruptRules.lockedCards).toEqual([]);
    expect(corruptRules.battleHistory).toHaveLength(1);

    expect(parseLedger(null)).toEqual(emptyLedger());
  });

  it("toggles keep and avoid as mutually exclusive without dropping history", () => {
    const start: LearningLedger = {
      ...emptyLedger(),
      battleHistory: [battle("20260919T100000.000Z")],
    };

    const kept = toggleLockedCard(start, "Knight");
    expect(kept.lockedCards).toEqual(["Knight"]);
    expect(kept.battleHistory).toHaveLength(1);

    const avoided = toggleExcludedCard(kept, "Knight");
    expect(avoided.lockedCards).toEqual([]);
    expect(avoided.excludedCards).toEqual(["Knight"]);

    expect(toggleExcludedCard(avoided, "Knight").excludedCards).toEqual([]);
  });

  it("sends only constraints and suggestions as feedback", () => {
    const ledger: LearningLedger = {
      ...emptyLedger(),
      lockedCards: ["Knight"],
      battleHistory: [battle("20260919T100000.000Z")],
    };
    expect(toFeedbackInput(ledger)).toEqual({
      lockedCards: ["Knight"],
      excludedCards: [],
      suggestionHistory: [],
    });
    expect(hasLedgerData(emptyLedger())).toBe(false);
    expect(hasLedgerData(ledger)).toBe(true);
  });

  it("builds no suggestion entry when the advisor keeps the deck", () => {
    expect(buildSuggestionEntry(response({ changes: [] }))).toBeNull();
    expect(buildSuggestionEntry(response({}))).toMatchObject({
      mode: "improve",
      baselineDeck: CURRENT,
      recommendedDeck: IMPROVED,
      baselineWinRate: 40,
      recommendedSwaps: [{ out: "Minion Horde", in: "Musketeer" }],
    });
  });

  it("records the suggestion once and accumulates deduped battles across visits", () => {
    const firstVisit = recordAnalysis(
      emptyLedger(),
      response({
        battleLog: [
          battle("20260919T100000.000Z"),
          battle("20260919T090000.000Z"),
        ],
      }),
    );
    expect(firstVisit.suggestionHistory).toHaveLength(1);
    expect(firstVisit.battleHistory).toHaveLength(2);

    const secondVisit = recordAnalysis(
      firstVisit,
      response({
        battleLog: [
          battle("20260919T110000.000Z"),
          battle("20260919T100000.000Z"),
        ],
      }),
    );
    expect(secondVisit.suggestionHistory).toHaveLength(1);
    expect(secondVisit.battleHistory.map((b) => b.battleTime)).toEqual([
      "20260919T110000.000Z",
      "20260919T100000.000Z",
      "20260919T090000.000Z",
    ]);
  });
});
