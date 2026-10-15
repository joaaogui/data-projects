import { describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import {
  buildDeckVersions,
  buildLossAutopsy,
  classifyOpponentArchetype,
  deckKeyOf,
  evaluateDeckChangeImpacts,
  normalizeBattles,
  parseClashBattleTime,
} from "./learning-engine";
import type { Battle, ClashCard, StoredSuggestionEntry } from "./types";

function makeCard(name: string, elixir = 3, level = 14): ClashCard {
  return {
    id: name.length * 17,
    name,
    level,
    maxLevel: 16,
    rarity: "common",
    elixirCost: elixir,
    iconUrls: { medium: "https://example.com/c.png" },
  };
}

const DECK_V1 = [
  "Skeleton Barrel",
  "Goblin Gang",
  "Skeleton Army",
  "Minion Horde",
  "Wizard",
  "Golden Knight",
  "Fireball",
  "P.E.K.K.A",
];

const DECK_V2 = [
  "Skeleton Barrel",
  "Goblin Gang",
  "Skeleton Army",
  "Minions",
  "Royal Delivery",
  "Golden Knight",
  "Fireball",
  "P.E.K.K.A",
];

const OPP_MEGA_KNIGHT = [
  "Mega Knight",
  "Witch",
  "Wizard",
  "Goblin Barrel",
  "Skeleton Army",
  "Bats",
  "Zap",
  "Fireball",
];

const OPP_LAVALOON = [
  "Lava Hound",
  "Balloon",
  "Mega Minion",
  "Baby Dragon",
  "Skeleton Dragons",
  "Tombstone",
  "Arrows",
  "Zap",
];

const OPP_HOG_CYCLE = [
  "Hog Rider",
  "Musketeer",
  "Ice Golem",
  "Cannon",
  "Skeletons",
  "Ice Spirit",
  "The Log",
  "Fireball",
];

function makeBattle(input: {
  battleTime: string;
  playerDeck: string[];
  opponentDeck: string[];
  playerCrowns: number;
  opponentCrowns: number;
  trophyChange?: number;
  opponentName?: string;
}): Battle {
  return {
    type: "PvP",
    battleTime: input.battleTime,
    gameMode: { id: 72000006, name: "Ladder" },
    team: [
      {
        tag: "#VGURQ0QQ2",
        name: "Player",
        crowns: input.playerCrowns,
        trophyChange: input.trophyChange,
        cards: input.playerDeck.map((name) => makeCard(name)),
      },
    ],
    opponent: [
      {
        tag: "#OPP1",
        name: input.opponentName ?? "Rival",
        crowns: input.opponentCrowns,
        cards: input.opponentDeck.map((name) => makeCard(name)),
      },
    ],
  };
}

describe("learning-engine", () => {
  it("parses Clash Royale compact timestamps and ISO strings", () => {
    const compact = parseClashBattleTime("20260919T143210.000Z");
    const iso = parseClashBattleTime("2026-09-19T14:32:10.000Z");

    expect(compact).toBeGreaterThan(0);
    expect(compact).toBe(iso);
    expect(parseClashBattleTime("invalid")).toBe(0);
  });

  it("classifies opponent archetypes accurately", () => {
    expect(classifyOpponentArchetype(OPP_MEGA_KNIGHT)).toBe("Mega Knight Beatdown");
    expect(classifyOpponentArchetype(OPP_LAVALOON)).toBe("LavaLoon / Air");
    expect(classifyOpponentArchetype(OPP_HOG_CYCLE)).toBe("Hog Cycle");
    expect(
      classifyOpponentArchetype([
        "Goblin Barrel",
        "Princess",
        "Goblin Gang",
        "Knight",
        "Inferno Tower",
        "Rocket",
        "The Log",
        "Ice Spirit",
      ]),
    ).toBe("Log Bait");
  });

  it("normalizes battles preserving wins, losses, player decks, trophy deltas, and chronological sorting", () => {
    const battles: Battle[] = [
      makeBattle({
        battleTime: "20260919T100000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 0,
        opponentCrowns: 3,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T120000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 2,
        opponentCrowns: 1,
        trophyChange: 29,
      }),
    ];

    const normalized = normalizeBattles(battles, "#VGURQ0QQ2");

    expect(normalized).toHaveLength(2);
    // Newest first
    expect(normalized[0]?.battleTime).toBe("20260919T120000.000Z");
    expect(normalized[0]?.outcome).toBe("win");
    expect(normalized[0]?.trophyChange).toBe(29);
    expect(normalized[0]?.playerDeck).toEqual(DECK_V2);

    expect(normalized[1]?.outcome).toBe("loss");
    expect(normalized[1]?.trophyChange).toBe(-30);
    expect(normalized[1]?.crownDiff).toBe(-3);
    expect(normalized[1]?.playerDeck).toEqual(DECK_V1);
  });

  it("groups battle log into deck versions, computes W/L and win rates, and tracks swaps", () => {
    const battles: Battle[] = [
      // v1: 1 win, 3 losses (25% WR -> underperforming)
      makeBattle({
        battleTime: "20260919T100000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 1,
        opponentCrowns: 2,
        trophyChange: -28,
      }),
      makeBattle({
        battleTime: "20260919T101000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 0,
        opponentCrowns: 3,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T102000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 2,
        opponentCrowns: 1,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T103000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 1,
        opponentCrowns: 2,
        trophyChange: -29,
      }),
      // v2: 3 wins, 1 loss (75% WR -> working)
      makeBattle({
        battleTime: "20260919T110000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 2,
        opponentCrowns: 0,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T111000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 1,
        opponentCrowns: 0,
        trophyChange: 29,
      }),
      makeBattle({
        battleTime: "20260919T112000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 1,
        opponentCrowns: 2,
        trophyChange: -28,
      }),
      makeBattle({
        battleTime: "20260919T113000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 3,
        opponentCrowns: 1,
        trophyChange: 31,
      }),
    ];

    const normalized = normalizeBattles(battles, "#VGURQ0QQ2");
    const versions = buildDeckVersions(normalized, DECK_V2);

    expect(versions).toHaveLength(2);
    const v2 = versions.find((v) => v.deckKey === deckKeyOf(DECK_V2))!;
    const v1 = versions.find((v) => v.deckKey === deckKeyOf(DECK_V1))!;

    expect(v1.versionLabel).toBe("v1");
    expect(v1.wins).toBe(1);
    expect(v1.losses).toBe(3);
    expect(v1.winRate).toBe(25);
    expect(v1.verdict).toBe("underperforming");

    expect(v2.versionLabel).toBe("v2");
    expect(v2.isCurrentActiveDeck).toBe(true);
    expect(v2.wins).toBe(3);
    expect(v2.losses).toBe(1);
    expect(v2.winRate).toBe(75);
    expect(v2.verdict).toBe("working");
    expect(v2.swapsFromPrevious).toHaveLength(2);
    expect(v2.swapsFromPrevious.map((s) => s.out).sort()).toEqual([
      "Minion Horde",
      "Wizard",
    ]);
    expect(v2.swapsFromPrevious.map((s) => s.in).sort()).toEqual([
      "Minions",
      "Royal Delivery",
    ]);
  });

  it("evaluates before/after deck change impacts and matches advisor suggestions", () => {
    const battles: Battle[] = [
      // v1: 1W-3L (25% WR)
      makeBattle({
        battleTime: "20260919T100000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 0,
        opponentCrowns: 2,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T101000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 0,
        opponentCrowns: 1,
        trophyChange: -29,
      }),
      makeBattle({
        battleTime: "20260919T102000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 2,
        opponentCrowns: 1,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T103000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 1,
        opponentCrowns: 3,
        trophyChange: -30,
      }),
      // v2: 3W-0L (100% WR)
      makeBattle({
        battleTime: "20260919T110000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 2,
        opponentCrowns: 1,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T111000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 1,
        opponentCrowns: 0,
        trophyChange: 29,
      }),
      makeBattle({
        battleTime: "20260919T112000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 2,
        opponentCrowns: 0,
        trophyChange: 30,
      }),
    ];

    const normalized = normalizeBattles(battles, "#VGURQ0QQ2");
    const versions = buildDeckVersions(normalized, DECK_V2);

    const suggestions: StoredSuggestionEntry[] = [
      {
        id: "sug-improve-1",
        createdAt: "2026-09-19T10:45:00.000Z",
        mode: "improve",
        baselineDeck: DECK_V1,
        baselineWinRate: 25,
        recommendedDeck: DECK_V2,
        recommendedSwaps: [
          { out: "Minion Horde", in: "Minions" },
          { out: "Wizard", in: "Royal Delivery" },
        ],
        archetypeName: "Skeleton Barrel Bait",
      },
    ];

    const impacts = evaluateDeckChangeImpacts(versions, suggestions, DECK_V2);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.source).toBe("advisor-full");
    expect(impacts[0]?.matchedSuggestionId).toBe("sug-improve-1");
    expect(impacts[0]?.beforeWinRate).toBe(25);
    expect(impacts[0]?.afterWinRate).toBe(100);
    expect(impacts[0]?.winRateDelta).toBe(75);
    expect(impacts[0]?.verdict).toBe("helped");
  });

  it("detects hurt, inconclusive, and pending change verdicts", () => {
    const deckV3 = DECK_V2.map((c) => (c === "Minions" ? "Bats" : c));
    const deckUntested = deckV3.map((c) => (c === "Fireball" ? "Poison" : c));

    const battles: Battle[] = [
      // v1 (DECK_V2): 3W-0L (100% WR)
      makeBattle({
        battleTime: "20260919T090000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 2,
        opponentCrowns: 0,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T091000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 1,
        opponentCrowns: 0,
        trophyChange: 30,
      }),
      makeBattle({
        battleTime: "20260919T092000.000Z",
        playerDeck: DECK_V2,
        opponentDeck: OPP_HOG_CYCLE,
        playerCrowns: 2,
        opponentCrowns: 1,
        trophyChange: 30,
      }),
      // v2 (deckV3): 0W-3L (0% WR -> hurt)
      makeBattle({
        battleTime: "20260919T100000.000Z",
        playerDeck: deckV3,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 0,
        opponentCrowns: 3,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T101000.000Z",
        playerDeck: deckV3,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 0,
        opponentCrowns: 2,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T102000.000Z",
        playerDeck: deckV3,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 1,
        opponentCrowns: 2,
        trophyChange: -30,
      }),
    ];

    const normalized = normalizeBattles(battles, "#VGURQ0QQ2");
    const versions = buildDeckVersions(normalized, deckUntested);
    const impacts = evaluateDeckChangeImpacts(versions, [], deckUntested);

    const pendingImpact = impacts.find((i) => i.verdict === "pending");
    const hurtImpact = impacts.find((i) => i.verdict === "hurt");

    expect(pendingImpact).toBeDefined();
    expect(pendingImpact?.swaps).toEqual([{ out: "Fireball", in: "Poison" }]);

    expect(hurtImpact).toBeDefined();
    expect(hurtImpact?.swaps).toEqual([{ out: "Minions", in: "Bats" }]);
    expect(hurtImpact?.winRateDelta).toBe(-100);
  });

  it("returns change impacts newest first even when an old version matched a saved suggestion", () => {
    const deckV3 = DECK_V2.map((c) => (c === "Minions" ? "Bats" : c));
    const decks = [DECK_V1, DECK_V2, deckV3];
    const battles: Battle[] = decks.flatMap((deck, deckIndex) =>
      [0, 1, 2].map((game) =>
        makeBattle({
          battleTime: `2026091${deckIndex + 1}T10${game}000.000Z`,
          playerDeck: deck,
          opponentDeck: OPP_HOG_CYCLE,
          playerCrowns: 1,
          opponentCrowns: game === 0 ? 2 : 0,
          trophyChange: game === 0 ? -30 : 30,
        }),
      ),
    );
    const suggestions: StoredSuggestionEntry[] = [
      {
        id: "sug-old",
        createdAt: "2026-09-10T10:00:00.000Z",
        mode: "improve",
        baselineDeck: DECK_V1.map((c) => (c === "P.E.K.K.A" ? "Golem" : c)),
        baselineWinRate: 40,
        recommendedDeck: DECK_V1,
        recommendedSwaps: [{ out: "Golem", in: "P.E.K.K.A" }],
        archetypeName: "Bait",
      },
    ];

    const versions = buildDeckVersions(
      normalizeBattles(battles, "#VGURQ0QQ2"),
      deckV3,
    );
    const impacts = evaluateDeckChangeImpacts(versions, suggestions, deckV3);

    expect(impacts.map((impact) => impact.toVersionLabel)).toEqual([
      "v3",
      "v2",
      "v1",
    ]);
    expect(impacts[0]?.swaps).toEqual([{ out: "Minions", in: "Bats" }]);
  });

  it("builds loss autopsy identifying recurring threat cards and blind spots", () => {
    const battles: Battle[] = [
      makeBattle({
        battleTime: "20260919T120000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 0,
        opponentCrowns: 3,
        trophyChange: -30,
      }),
      makeBattle({
        battleTime: "20260919T115000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_LAVALOON,
        playerCrowns: 1,
        opponentCrowns: 2,
        trophyChange: -29,
      }),
      makeBattle({
        battleTime: "20260919T114000.000Z",
        playerDeck: DECK_V1,
        opponentDeck: OPP_MEGA_KNIGHT,
        playerCrowns: 0,
        opponentCrowns: 1,
        trophyChange: -30,
      }),
    ];

    const normalized = normalizeBattles(battles, "#VGURQ0QQ2");
    const currentProfiles = DECK_V1.map((name) =>
      buildCardProfile(makeCard(name)),
    );
    const viableProfiles = [
      ...DECK_V1,
      "Archers",
      "Musketeer",
      "Minions",
      "Royal Delivery",
      "Cannon",
      "Tesla",
    ].map((name) => buildCardProfile(makeCard(name)));

    const autopsy = buildLossAutopsy(
      normalized,
      currentProfiles,
      viableProfiles,
    );

    expect(autopsy.totalBattlesAnalyzed).toBe(3);
    expect(autopsy.recentWins).toBe(0);
    expect(autopsy.recentLosses).toBe(3);
    expect(autopsy.recentWinRate).toBe(0);
    expect(autopsy.currentStreak).toEqual({ type: "loss", count: 3 });
    expect(autopsy.threeCrownLosses).toBe(1);
    expect(autopsy.oneCrownLosses).toBe(2);

    const threatNames = autopsy.topThreatCards.map((t) => t.cardName);
    expect(threatNames).toContain("Balloon");
    expect(threatNames).toContain("Lava Hound");
    expect(autopsy.dominantBlindSpots.length).toBeGreaterThan(0);
  });
});
