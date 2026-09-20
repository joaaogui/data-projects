import "server-only";

import { generateText } from "ai";

import { recommendArchetype } from "./archetype-engine";
import { getAiModelChain, instantiateModel } from "./ai-provider";
import { groundedClaims } from "./claim-check";
import type { EngineContext } from "./engine-context";
import type { DeckAnalysis } from "./schemas";

export interface EngineResult {
  analysis: DeckAnalysis;
  diagnostics: {
    candidatesRequested: number;
    candidatesAccepted: number;
    candidatesRejected: { modelLabel: string; reason: string }[];
    winningModel: string;
    explanationModel: string;
    currentScore: number;
    chosenScore: number;
    keptCurrentDeck: boolean;
    discardedForTooManySwaps: number;
  };
}

function readiness(deck: { level: number }[]): number {
  if (deck.length === 0) return 0;
  const ready = deck.filter((card) => card.level >= 11).length;
  return Math.round((ready / deck.length) * 100);
}

/**
 * Rewrites only the coaching sentences. The deck, swaps, and evidence stay
 * local. If the model names a card that is not in the deck, or invents a
 * replay, the deterministic copy is kept.
 */
async function polishCopy(
  analysis: DeckAnalysis,
  knownCards: string[],
): Promise<{ analysis: DeckAnalysis; modelLabel: string }> {
  const allowed = [
    ...analysis.originalDeck,
    ...analysis.improvedDeck,
    ...analysis.changes.flatMap((change) => [change.out, change.in]),
  ];
  const facts = {
    archetype: analysis.metaTier.archetype,
    deck: analysis.improvedDeck,
    changes: analysis.changes,
    strengths: analysis.evidence?.strengths ?? [],
    weaknesses: analysis.evidence?.weaknesses ?? [],
    strategy: analysis.strategy,
    verdictReason: analysis.verdictReason,
  };

  try {
    const config = getAiModelChain()[0];
    if (!config) return { analysis, modelLabel: "deterministic" };

    const result = await Promise.race([
      generateText({
        model: instantiateModel(config),
        temperature: 0.2,
        maxOutputTokens: 400,
        system: [
          "Rewrite the supplied Clash Royale coaching in two short sentences.",
          "Use only the facts in the prompt.",
          "Do not name a card that is not in the supplied deck or changes.",
          "Do not mention replays, placements, or elixir trades you were not given.",
          "Return plain text, not JSON.",
        ].join(" "),
        prompt: JSON.stringify(facts),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("explanation timed out")), 12_000),
      ),
    ]);

    const problems = groundedClaims({
      text: result.text,
      allowedCards: allowed,
      knownCards,
    });
    if (problems.length > 0 || result.text.trim().length < 40) {
      return { analysis, modelLabel: "deterministic" };
    }

    return {
      analysis: { ...analysis, strategy: result.text.trim() },
      modelLabel: config.label,
    };
  } catch {
    return { analysis, modelLabel: "deterministic" };
  }
}

export async function runDeckEngine(
  engine: EngineContext,
): Promise<EngineResult> {
  const recommendation = recommendArchetype({
    owned: engine.ownedCards,
    current: engine.currentDeck,
    metaDecks: engine.context.metaDecks,
    losses: engine.context.recentLosses,
    mode: engine.mode,
  });
  const polished = await polishCopy(
    recommendation.analysis,
    engine.ownedCards.map((card) => card.name),
  );

  return {
    analysis: polished.analysis,
    diagnostics: {
      candidatesRequested: 4,
      candidatesAccepted: recommendation.keptCurrentDeck ? 1 : 2,
      candidatesRejected: [],
      winningModel: recommendation.analysis.evidence?.archetypeId ?? "current",
      explanationModel: polished.modelLabel,
      currentScore: readiness(engine.currentDeck),
      chosenScore: recommendation.analysis.evidence?.levelReadiness ?? 0,
      keptCurrentDeck: recommendation.keptCurrentDeck,
      discardedForTooManySwaps: 0,
    },
  };
}
