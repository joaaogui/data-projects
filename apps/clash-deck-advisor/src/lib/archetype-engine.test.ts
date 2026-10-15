import { describe, expect, it } from "vitest";

import {
  classifyArchetype,
  gateFailures,
  lockedNames,
  rankArchetypes,
  recommendArchetype,
  scoreHistoryFeedback,
  scoreLossCounters,
} from "./archetype-engine";
import { buildCardProfiles } from "./card-knowledge";
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
    (name) => owned.find((card) => card.name === name) ?? currentProfiles.find((card) => card.name === name)!,
  );
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

  it("improves the current deck without removing its bait core", () => {
    const result = recommendArchetype({
      owned,
      current: currentProfiles,
      metaDecks: [],
      losses: [],
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

  it("boosts swaps that counter recurring threats in lossAutopsy and attaches counterTargets", () => {
    const lossBattles: Battle[] = [1, 2, 3].map((idx) => ({
      type: "PvP",
      battleTime: `20260919T120${idx}00.000Z`,
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

  it("overrides keep verdict when the current deck is losing (<45% WR over >=3 battles)", () => {
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

    // With 0W-4L battle history on this exact deck, keeping it is penalized (-30)
    // and the advisor recommends a targeted counter swap instead of "keep".
    const failingVersion: DeckVersionSummary = {
      deckKey: deckKeyOf(canonicalBaitNames),
      versionLabel: "v1",
      cards: canonicalBaitNames,
      isCurrentActiveDeck: true,
      battles: 4,
      wins: 0,
      losses: 4,
      draws: 0,
      winRate: 0,
      netTrophies: -120,
      avgCrownDiff: -2,
      firstSeen: "20260919T100000.000Z",
      lastSeen: "20260919T104000.000Z",
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
          battleTime: "20260919T104000.000Z",
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
        beforeBattles: 4,
        beforeWinRate: 50,
        afterBattles: 4,
        afterWinRate: 25,
        winRateDelta: -25,
        trophyDelta: -60,
        verdict: "hurt",
        summary: "Dropped WR from 50% to 25%",
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
      changeImpacts: hurtImpacts,
      mode: "improve",
    });

    // Should pivot away from at least one of the hurt incoming cards (e.g. choosing Archers or Arrows)
    expect(rec.analysis.evidence?.avoidedFailedSwaps?.length).toBeGreaterThan(
      0,
    );
  });

  it("respects lockedCards and excludedCards from player feedback", () => {
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
