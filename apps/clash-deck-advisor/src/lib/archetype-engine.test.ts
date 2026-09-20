import { describe, expect, it } from "vitest";

import {
  classifyArchetype,
  gateFailures,
  rankArchetypes,
  recommendArchetype,
} from "./archetype-engine";
import { buildCardProfiles } from "./card-knowledge";
import snapshot from "./fixtures/player-snapshot.json";
import type { ClashCard, MetaDeckReference } from "./types";

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
});
