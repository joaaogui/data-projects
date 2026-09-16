import "server-only";

import { generateObject } from "ai";
import { unstable_cache } from "next/cache";

import { createAiModel } from "./ai-provider";
import { getAnalysisContext, PLAYER_TAG } from "./clash-royale";
import { validateAnalysis } from "./deck-validation";
import { getLevelWarnings, normalizeCardLevel } from "./level-warnings";
import { deckAnalysisSchema } from "./schemas";
import type { AnalysisResponse } from "./types";

const ANALYSIS_CACHE_SECONDS = 30 * 60;

async function generateDeckAnalysis(): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const context = await getAnalysisContext();
  const levelWarnings = getLevelWarnings(context.player.currentDeck);
  const model = createAiModel();

  const currentDeck = context.player.currentDeck.map((card) => ({
    name: card.name,
    level: normalizeCardLevel(card),
    evolutionOwned: (card.evolutionLevel ?? 0) > 0,
    rarity: card.rarity,
    elixirCost: card.elixirCost,
  }));
  const ownedCards = context.player.cards.map((card) => ({
    name: card.name,
    level: normalizeCardLevel(card),
    evolutionOwned: (card.evolutionLevel ?? 0) > 0,
    rarity: card.rarity,
    elixirCost: card.elixirCost,
  }));

  const { object } = await generateObject({
    model,
    schema: deckAnalysisSchema,
    schemaName: "clashDeckAnalysis",
    schemaDescription:
      "A single evidence-based Clash Royale analysis of the player's current deck.",
    temperature: 0.2,
    maxOutputTokens: 3_500,
    system: [
      "You are an expert Clash Royale deck coach.",
      "Analyze the current deck exactly once and return only the requested structured object.",
      "Prefer keeping the current deck. Recommend a swap only when the supplied levels, recent losses, and meta evidence make it clearly superior.",
      'If no option is clearly better, set verdict to "keep", copy originalDeck to improvedDeck unchanged, and return an empty changes array.',
      "Recommend between zero and three swaps. Every outgoing card must be in originalDeck and every incoming card must be owned.",
      "Use exact card names from the supplied data.",
      "Both decks must contain exactly eight unique cards.",
      "The improved deck must contain at least two evolution-capable cards and exactly one card whose rarity is champion. Having more than two evolution-capable cards is valid; only two are activated in the deck link.",
      "Do not invent replay events. Ground replay advice in the supplied recent-loss evidence.",
      "Return exactly five broad matchup assessments and score each strength dimension from 0 to 100.",
      "Only list genuine problems; an empty problems array is valid.",
    ].join("\n"),
    prompt: JSON.stringify({
      player: {
        tag: context.player.tag,
        name: context.player.name,
        trophies: context.player.trophies,
        arena: context.player.arena.name,
      },
      currentDeck,
      ownedCards,
      recentLosses: context.recentLosses,
      topLadderWinningDecks: context.metaDecks,
      metaEvidenceAvailable: context.metaAvailable,
      deterministicLevelWarnings: levelWarnings,
    }),
  });

  let analysis;
  try {
    analysis = validateAnalysis(object, context.player);
  } catch (error) {
    console.error("[clash-deck-advisor] rejected invalid AI analysis", {
      message:
        error instanceof Error ? error.message : "Unknown validation error",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }

  const response: AnalysisResponse = {
    analysis,
    player: context.player,
    levelWarnings,
    generatedAt: new Date().toISOString(),
    metaAvailable: context.metaAvailable,
  };

  console.info("[clash-deck-advisor] generated analysis", {
    durationMs: Date.now() - startedAt,
    recentLossCount: context.recentLosses.length,
    metaDeckCount: context.metaDecks.length,
  });

  return response;
}

export const getCachedDeckAnalysis = unstable_cache(
  generateDeckAnalysis,
  ["clash-deck-advisor", PLAYER_TAG, "analysis-v3"],
  {
    revalidate: ANALYSIS_CACHE_SECONDS,
    tags: ["clash-deck-advisor-analysis"],
  },
);
