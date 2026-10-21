import { describe, expect, it } from "vitest";

import {
  classifyArchetype,
  gateFailures,
  lockedNames,
  MIN_BATTLES_FOR_SWAP,
  rankArchetypes,
  recommendArchetype,
  scoreHistoryFeedback,
  scoreLossCounters,
} from "./archetype-engine";
import { buildCardProfiles, type CardProfile } from "./card-knowledge";
import snapshot from "./fixtures/player-snapshot.json";
import {
  buildLossAutopsy,
  deckKeyOf,
  normalizeBattles,
} from "./learning-engine";
import type {
  Battle,
  ClashCard,
  DeckChangeImpact,
  DeckVersionSummary,
  MetaDeckReference,
} from "./types";

const cards = snapshot.cards as ClashCard[];
const current = snapshot.currentDeck as ClashCard[];
const owned = buildCardProfiles(cards);
const currentProfiles = buildCardProfiles(current);

function deckNamed(names: string[]) {
  return names.map(
    (name) =>
      owned.find((card) => card.name === name) ??
      currentProfiles.find((card) => card.name === name)!,
  );
}

function makeDeckVersion(
  deck: CardProfile[],
  battles: number,
  wins = Math.floor(battles / 2),
): DeckVersionSummary {
  const names = deck.map((card) => card.name);
  const losses = Math.max(0, battles - wins);
  const winRate =
    battles > 0 ? Math.round((wins / battles) * 1000) / 10 : 0;
  return {
    deckKey: deckKeyOf(names),
    versionLabel: "v1",
    cards: names,
    isCurrentActiveDeck: true,
    battles,
    wins,
    losses,
    draws: 0,
    winRate,
    netTrophies: (wins - losses) * 30,
    avgCrownDiff: wins >= losses ? 1 : -1,
    firstSeen: "20260919T100000.000Z",
    lastSeen: "20260919T110000.000Z",
    swapsFromPrevious: [],
    swapsToCurrent: [],
    topLossesAgainst: [],
    verdict:
      battles === 0
        ? "untested"
        : battles < 3
          ? "testing"
          : winRate >= 52
            ? "working"
            : winRate < 50
              ? "underperforming"
              : "testing",
  };
}

describe("archetype recommendation", () => {
  it("classifies the current deck as Skeleton Barrel bait", () => {
    expect(classifyArchetype(current.map((card) => card.name)).id).toBe(
      "skeleton-barrel-bait",
    );
  });

  it("rejects the wizard plus witch role soup", () => {
    const soup = deckNamed([
      "P.E.K.K.A",
      "Golden Knight",
      "Skeleton Army",
      "Witch",
      "Wizard",
      "Goblin Gang",
      "Skeleton Barrel",
      "Fireball",
    ]);

    expect(gateFailures(soup).join(" ")).toMatch(/spell value/i);
  });

  it("rejects adding a level 9 spell", () => {
    const withZap = deckNamed([
      "P.E.K.K.A",
      "Golden Knight",
      "Skeleton Army",
      "Zap",
      "Wizard",
      "Goblin Gang",
      "Skeleton Barrel",
      "Fireball",
    ]);

    expect(gateFailures(withZap).join(" ")).toMatch(/Zap/);
  });

  it("rejects a pump being treated as a tank answer", () => {
    const pumped = deckNamed([
      "Elixir Collector",
      "Knight",
      "Archers",
      "Fireball",
      "The Log",
      "Skeletons",
      "Ice Spirit",
      "Hog Rider",
    ]);

    expect(gateFailures(pumped).join(" ")).toMatch(/Elixir Collector/);
  });

  it("never suggests swaps in improve mode when currentDeck has fewer than 20 battles (0..19 battles)", () => {
    expect(MIN_BATTLES_FOR_SWAP).toBe(20);

    for (
      let battleCount = 0;
      battleCount < MIN_BATTLES_FOR_SWAP;
      battleCount += 1
    ) {
      const wins = Math.min(1, battleCount);
      const version = makeDeckVersion(currentProfiles, battleCount, wins);
      const result = recommendArchetype({
        owned,
        current: currentProfiles,
        metaDecks: [],
        losses: [],
        deckVersions: [version],
        mode: "improve",
      });

      expect(result.keptCurrentDeck).toBe(true);
      expect(result.analysis.verdict).toBe("keep");
      expect(result.analysis.changes).toEqual([]);
      expect(result.analysis.improvedDeck).toEqual(
        currentProfiles.map((c) => c.name),
      );

      if (battleCount === 0) {
        expect(result.analysis.verdictReason).toBe(
          "We have 0 recorded battles with this exact 8-card deck. Play 20 matches with it first so recommendations are based on real results with this deck, not guesses.",
        );
      } else {
        const remaining = MIN_BATTLES_FOR_SWAP - battleCount;
        expect(result.analysis.verdictReason).toContain(
          `Only ${battleCount} recorded battle${battleCount === 1 ? "" : "s"} with this exact deck`,
        );
        expect(result.analysis.verdictReason).toContain(
          `Play ${remaining} more`,
        );
      }
    }
  });

  it("improves the current deck without removing its bait core once 20+ battles are recorded", () => {
    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
      deckVersions: [makeDeckVersion(currentProfiles, 20, 8)],
      mode: "improve",
    });
    const deck = result.analysis.improvedDeck;

    expect(deck).toContain("Skeleton Barrel");
    expect(deck).toContain("Goblin Gang");
    expect(deck).toContain("Skeleton Army");
    expect(deck).not.toContain("Minion Horde");
    expect(deck).not.toContain("Witch");
    expect(deck).not.toContain("Zap");
    expect(result.analysis.changes.length).toBeLessThanOrEqual(3);
    expect(result.analysis.changes.length).toBeGreaterThan(0);
  });

  it("picks Royal Recruits bait as the best collection deck", () => {
    const ranked = rankArchetypes({
      owned,
      current: currentProfiles,
      metaDecks: [],
      mode: "best",
    });

    expect(ranked[0]?.template.id).toBe("royal-recruits-bait");
    expect(ranked[0]?.deck.map((card) => card.name)).toEqual(
      expect.arrayContaining([
        "Royal Recruits",
        "Wall Breakers",
        "Skeleton Barrel",
      ]),
    );
    expect(ranked[0]?.deck.map((card) => card.name)).not.toContain("Witch");
    expect(ranked[0]?.deck.map((card) => card.name)).not.toContain("Wizard");
  });

  it("ranks the coherent recruits shell above the current role soup", () => {
    const ranked = rankArchetypes({
      owned,
      current: currentProfiles,
      metaDecks: [],
      mode: "best",
    });
    const recruits = ranked.find(
      (candidate) => candidate.template.id === "royal-recruits-bait",
    );
    const barrel = ranked.find(
      (candidate) => candidate.template.id === "skeleton-barrel-bait",
    );

    expect(recruits).toBeDefined();
    expect(barrel).toBeDefined();
    expect(ranked.indexOf(recruits!)).toBeLessThan(ranked.indexOf(barrel!));
  });

  it("does not invent replay placements", () => {
    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [
        {
          battleTime: "20260919T000000.000Z",
          opponentName: "Rival",
          opponentCrowns: 2,
          playerCrowns: 0,
          opponentDeck: ["Hog Rider", "Musketeer", "Cannon", "The Log"],
        },
      ],
      deckVersions: [makeDeckVersion(currentProfiles, 20, 8)],
      mode: "improve",
    });

    const text = result.analysis.replayAdvice.map((note) => note.detail).join(" ");
    expect(text).toMatch(/does not show placements/i);
    expect(text).not.toMatch(/clustered/i);
  });

  it("keeps matchup advice limited to cards the deck can actually play", () => {
    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
      mode: "best",
    });
    const advice = result.analysis.matchups.map((matchup) => matchup.advice).join(" ");

    expect(advice).not.toMatch(/Poison/);
    expect(advice).not.toMatch(/Magic Archer/);
    // Zero live sample cannot claim high live-meta confidence.
    expect(result.analysis.evidence?.confidence).not.toBe("high");
    expect(result.analysis.evidence?.liveMetaOverlap).toBe(0);
  });

  it("never marks confidence high when meta decks are empty or have zero overlap", () => {
    const unrelatedMeta: MetaDeckReference[] = [
      {
        playerTag: "#META1",
        playerName: "Meta One",
        rating: 9_000,
        deck: [
          "Hog Rider",
          "Musketeer",
          "Ice Golem",
          "Ice Spirit",
          "Cannon",
          "Skeletons",
          "The Log",
          "Fireball",
        ],
      },
    ];

    for (const metaDecks of [[], unrelatedMeta] as MetaDeckReference[][]) {
      const best = recommendArchetype({
        owned,
        current: currentProfiles,
        metaDecks,
        losses: [],
        mode: "best",
      });
      const improve = recommendArchetype({
        owned,
        current: currentProfiles,
        metaDecks,
        losses: [],
        deckVersions: [makeDeckVersion(currentProfiles, 20, 8)],
        mode: "improve",
      });

      expect(best.analysis.evidence?.confidence).not.toBe("high");
      expect(improve.analysis.evidence?.confidence).not.toBe("high");
      expect(best.analysis.evidence?.liveMetaOverlap ?? 0).toBe(0);
      expect(improve.analysis.evidence?.liveMetaOverlap ?? 0).toBe(0);
    }
  });

  it("can mark confidence high when live meta overlap exists and the shell is strong", () => {
    const overlappingMeta: MetaDeckReference[] = [
      {
        playerTag: "#META1",
        playerName: "Recruits ladder",
        rating: 9_500,
        deck: [
          "Royal Recruits",
          "Wall Breakers",
          "Skeleton Barrel",
          "Goblin Gang",
          "Mighty Miner",
          "Archers",
          "Fireball",
          "Royal Delivery",
        ],
      },
    ];

    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: overlappingMeta,
      losses: [],
      mode: "best",
    });

    expect(result.analysis.evidence?.liveMetaOverlap).toBeGreaterThan(0);
    expect(result.analysis.evidence?.confidence).toBe("high");
  });

  it("does not lock non-core slot options in improve mode so counter swaps can happen", () => {
    const template = classifyArchetype(current.map((card) => card.name));
    const locked = lockedNames(template, currentProfiles);

    // Core cards stay locked
    expect(locked.has("Skeleton Barrel")).toBe(true);
    expect(locked.has("Goblin Gang")).toBe(true);
    expect(locked.has("Skeleton Army")).toBe(true);

    // Non-core slot options are no longer forcibly locked
    expect(locked.has("Golden Knight")).toBe(false);
    expect(locked.has("Fireball")).toBe(false);
    expect(locked.has("P.E.K.K.A")).toBe(false);
  });

  it("boosts swaps that counter recurring threats in lossAutopsy and attaches counterTargets when >= 20 battles are recorded", () => {
    const lossBattles: Battle[] = Array.from(
      { length: MIN_BATTLES_FOR_SWAP },
      (_, i) => i + 1,
    ).map((idx) => ({
      type: "PvP",
      battleTime: `20260919T12${String(idx).padStart(2, "0")}00.000Z`,
      team: [
        {
          tag: "#VGURQ0QQ2",
          name: "Player",
          crowns: 0,
          trophyChange: -30,
          cards: current,
        },
      ],
      opponent: [
        {
          tag: `#OPP${idx}`,
          name: `AirRival${idx}`,
          crowns: 3,
          cards: [
            "Lava Hound",
            "Balloon",
            "Goblin Barrel",
            "Princess",
            "Goblin Gang",
            "Skeleton Army",
            "Arrows",
            "Zap",
          ].map((name, i) => ({
            id: i + 1,
            name,
            level: 14,
            maxLevel: 16,
            rarity: "common",
            elixirCost: 4,
            iconUrls: { medium: "" },
          })),
        },
      ],
    }));

    const normalized = normalizeBattles(lossBattles, "#VGURQ0QQ2");
    const lossAutopsy = buildLossAutopsy(normalized, currentProfiles, owned);

    const rec = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
      lossAutopsy,
      mode: "improve",
    });

    const counterEval = scoreLossCounters(
      deckNamed(rec.analysis.improvedDeck),
      currentProfiles,
      lossAutopsy,
    );

    expect(counterEval.bonus).toBeGreaterThan(0);
    expect(counterEval.counteredThreats.length).toBeGreaterThan(0);
    expect(rec.analysis.evidence?.counteredThreats?.length).toBeGreaterThan(0);
    expect(
      rec.analysis.changes.some(
        (change) => (change.counterTargets?.length ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it("overrides keep verdict when the current deck is losing (<45% WR over >=20 battles)", () => {
    // Start with the canonical skeleton-barrel-bait 8-card deck so without
    // history feedback it would have 0 swaps ("keep").
    const canonicalBaitNames = [
      "Skeleton Barrel",
      "Goblin Gang",
      "Skeleton Army",
      "Minions",
      "Golden Knight",
      "Fireball",
      "Royal Delivery",
      "P.E.K.K.A",
    ];
    const canonicalBaitDeck = deckNamed(canonicalBaitNames);

    // Without battle history, the advisor keeps this deck
    const withoutHistory = recommendArchetype({
      owned,
      current: canonicalBaitDeck,
      metaDecks: [],
      losses: [],
      mode: "improve",
    });
    expect(withoutHistory.analysis.verdict).toBe("keep");

    // With 0W-20L battle history on this exact deck, keeping it is penalized (-30)
    // and the advisor recommends a targeted counter swap instead of "keep".
    const failingVersion: DeckVersionSummary = {
      deckKey: deckKeyOf(canonicalBaitNames),
      versionLabel: "v1",
      cards: canonicalBaitNames,
      isCurrentActiveDeck: true,
      battles: 20,
      wins: 0,
      losses: 20,
      draws: 0,
      winRate: 0,
      netTrophies: -600,
      avgCrownDiff: -2,
      firstSeen: "20260919T100000.000Z",
      lastSeen: "20260919T105000.000Z",
      swapsFromPrevious: [],
      swapsToCurrent: [],
      topLossesAgainst: ["Balloon", "Lava Hound"],
      verdict: "underperforming",
    };

    const withFailingHistory = recommendArchetype({
      owned,
      current: canonicalBaitDeck,
      metaDecks: [],
      losses: [
        {
          battleTime: "20260919T105000.000Z",
          opponentName: "LoonPlayer",
          opponentCrowns: 3,
          playerCrowns: 0,
          opponentDeck: [
            "Lava Hound",
            "Balloon",
            "Mega Minion",
            "Baby Dragon",
            "Skeleton Dragons",
            "Tombstone",
            "Arrows",
            "Zap",
          ],
        },
      ],
      deckVersions: [failingVersion],
      mode: "improve",
    });

    expect(withFailingHistory.keptCurrentDeck).toBe(false);
    expect(withFailingHistory.analysis.verdict).toBe("improve");
    expect(withFailingHistory.analysis.changes.length).toBeGreaterThan(0);
    expect(withFailingHistory.penalizedDecks).toContain("v1");
  });

  it("penalizes and avoids incoming swaps that produced a hurt verdict in changeImpacts", () => {
    const hurtImpacts: DeckChangeImpact[] = [
      {
        fromVersionLabel: "v1",
        toVersionLabel: "v2",
        fromDeck: current.map((c) => c.name),
        toDeck: [
          "Skeleton Barrel",
          "Goblin Gang",
          "Skeleton Army",
          "Minions",
          "Golden Knight",
          "Fireball",
          "Royal Delivery",
          "P.E.K.K.A",
        ],
        swaps: [
          { out: "Minion Horde", in: "Minions" },
          { out: "Wizard", in: "Royal Delivery" },
        ],
        source: "advisor-full",
        beforeBattles: 5,
        beforeWinRate: 50,
        afterBattles: 5,
        afterWinRate: 20,
        winRateDelta: -30,
        trophyDelta: -90,
        verdict: "hurt",
        summary: "Dropped WR from 50% to 20%",
      },
    ];

    const feedbackEval = scoreHistoryFeedback(
      deckNamed([
        "Skeleton Barrel",
        "Goblin Gang",
        "Skeleton Army",
        "Minions",
        "Golden Knight",
        "Fireball",
        "Royal Delivery",
        "P.E.K.K.A",
      ]),
      currentProfiles,
      [],
      hurtImpacts,
    );

    expect(feedbackEval.delta).toBeLessThan(0);

    const rec = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
      deckVersions: [makeDeckVersion(currentProfiles, 20, 8)],
      changeImpacts: hurtImpacts,
      mode: "improve",
    });

    // Should pivot away from at least one of the hurt incoming cards (e.g. choosing Archers or Arrows)
    expect(rec.analysis.evidence?.avoidedFailedSwaps?.length).toBeGreaterThan(
      0,
    );
  });

  it("respects lockedCards and excludedCards from player feedback even before 20 battles", () => {
    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
      feedback: {
        lockedCards: ["Wizard"],
        excludedCards: ["Minions", "Royal Delivery"],
        suggestionHistory: [],
      },
      mode: "improve",
    });

    expect(result.analysis.improvedDeck).toContain("Wizard");
    expect(result.analysis.improvedDeck).not.toContain("Minions");
    expect(result.analysis.improvedDeck).not.toContain("Royal Delivery");
  });
});
