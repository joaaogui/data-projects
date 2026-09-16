import { writeFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import { getAnalysisContext } from "./clash-royale";
import { runDeckEngine, type EngineResult } from "./deck-engine";
import { checkDeckLegality } from "./deck-rules";
import { scoreDeck } from "./deck-score";
import { buildEngineContext, type AnalysisMode } from "./engine-context";
import type { AnalysisContext } from "./types";

/**
 * End-to-end quality gate.
 *
 * Unit tests prove the scoring and rule modules behave; this proves the whole
 * engine returns something legal, playable, and actually explained when run
 * against the live API and real models.
 */

let context: AnalysisContext;
const results = new Map<AnalysisMode, EngineResult>();
const report: string[] = [];

function profilesFor(deck: string[]) {
  const owned = new Map(
    [...context.player.cards, ...context.player.currentDeck].map((card) => [
      card.name,
      card,
    ]),
  );
  return deck.map((name) => buildCardProfile(owned.get(name)!));
}

beforeAll(async () => {
  context = await getAnalysisContext();

  for (const mode of ["improve", "best"] as const) {
    const started = Date.now();
    const result = await runDeckEngine(buildEngineContext(context, mode));
    results.set(mode, result);

    report.push(
      `===== ${mode.toUpperCase()} (${Date.now() - started}ms) =====`,
      `deck:     ${result.analysis.improvedDeck.join(", ")}`,
      `verdict:  ${result.analysis.verdict} | ${result.analysis.verdictReason}`,
      `changes:  ${
        result.analysis.changes
          .map((change) => `${change.out} -> ${change.in}`)
          .join("; ") || "none"
      }`,
      `strategy: ${result.analysis.strategy}`,
      `problems: ${result.analysis.problems.map((problem) => problem.title).join("; ") || "none"}`,
      `matchups: ${result.analysis.matchups.map((matchup) => `${matchup.archetype}=${matchup.rating}`).join(", ")}`,
      `scores:   ${JSON.stringify(result.analysis.weaknessScores)}`,
      `diag:     ${JSON.stringify(result.diagnostics)}`,
      "",
    );
  }

  // Vitest hides console output on a passing run, so the report is written
  // where it can always be read after the fact.
  writeFileSync("/tmp/clash-eval-report.txt", report.join("\n"));
}, 180_000);

describe("live analysis context", () => {
  it("loads the player's current deck", () => {
    expect(context.player.currentDeck).toHaveLength(8);
  });

  it("finds live top-ladder meta decks", () => {
    expect(context.metaDecks.length).toBeGreaterThan(0);
    for (const deck of context.metaDecks) {
      expect(deck.deck).toHaveLength(8);
    }
  });
});

describe.each(["improve", "best"] as const)("%s mode", (mode) => {
  it("returns a deck of eight unique cards", () => {
    const deck = results.get(mode)!.analysis.improvedDeck;
    expect(deck).toHaveLength(8);
    expect(new Set(deck).size).toBe(8);
  });

  it("only uses cards the player owns", () => {
    const owned = new Set(
      [...context.player.cards, ...context.player.currentDeck].map(
        (card) => card.name,
      ),
    );
    for (const name of results.get(mode)!.analysis.improvedDeck) {
      expect(owned, `not owned: ${name}`).toContain(name);
    }
  });

  it("respects the special slot rules", () => {
    const legality = checkDeckLegality(
      profilesFor(results.get(mode)!.analysis.improvedDeck),
    );
    expect(legality.violations).toEqual([]);
  });

  it("does not score worse than the player's current deck", () => {
    const { diagnostics } = results.get(mode)!;
    expect(diagnostics.chosenScore).toBeGreaterThanOrEqual(
      diagnostics.currentScore,
    );
  });

  it("recommends a structurally sound deck", () => {
    const score = scoreDeck(
      profilesFor(results.get(mode)!.analysis.improvedDeck),
    );
    expect(score.components.winCondition).toBe(1);
    expect(score.components.airDefense).toBeGreaterThan(0);
    expect(score.components.spellCoverage).toBeGreaterThan(0);
    expect(score.averageElixir).toBeGreaterThan(2.2);
    expect(score.averageElixir).toBeLessThan(4.6);
  });

  it("reports the average elixir of the deck it actually returned", () => {
    const analysis = results.get(mode)!.analysis;
    const actual = scoreDeck(profilesFor(analysis.improvedDeck)).averageElixir;
    expect(analysis.averageElixir).toBeCloseTo(actual, 1);
  });

  it("keeps the change list consistent with the two decks", () => {
    const { originalDeck, improvedDeck, changes, verdict } =
      results.get(mode)!.analysis;
    const removed = originalDeck.filter((name) => !improvedDeck.includes(name));
    const added = improvedDeck.filter((name) => !originalDeck.includes(name));

    expect(changes).toHaveLength(removed.length);
    expect(changes.map((change) => change.out).sort()).toEqual(removed.sort());
    expect(changes.map((change) => change.in).sort()).toEqual(added.sort());
    expect(verdict).toBe(removed.length > 0 ? "improve" : "keep");
  });

  it("explains itself with usable coaching text", () => {
    const analysis = results.get(mode)!.analysis;

    expect(analysis.verdictReason.length).toBeGreaterThan(20);
    expect(analysis.strategy.length).toBeGreaterThan(40);
    expect(analysis.matchups).toHaveLength(5);
    for (const matchup of analysis.matchups) {
      expect(matchup.advice.length).toBeGreaterThan(10);
    }
    for (const change of analysis.changes) {
      expect(change.reason.length).toBeGreaterThan(10);
    }
  });
});

describe("improve mode specifically", () => {
  it("keeps the deck recognisable rather than rebuilding it", () => {
    expect(results.get("improve")!.analysis.changes.length).toBeLessThanOrEqual(
      3,
    );
  });

  it("starts from the player's actual current deck", () => {
    expect(results.get("improve")!.analysis.originalDeck.sort()).toEqual(
      context.player.currentDeck.map((card) => card.name).sort(),
    );
  });
});
