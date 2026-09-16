import "server-only";

import { generateObject } from "ai";

import {
  getAiModelChain,
  getCandidateModels,
  instantiateModel,
  type AiModelConfig,
} from "./ai-provider";
import { averageElixir } from "./card-knowledge";
import {
  diffDecks,
  rankCandidates,
  selectWinner,
  type DeckCandidate,
  type RankedCandidate,
} from "./deck-candidates";
import { scoreDeck, type DeckScore } from "./deck-score";
import {
  buildExplanationBrief,
  buildGenerationBrief,
  type AnalysisMode,
  type EngineContext,
} from "./engine-context";
import {
  deckCandidateSchema,
  deckExplanationSchema,
  type DeckAnalysis,
  type DeckExplanation,
} from "./schemas";

const CANDIDATE_TIMEOUT_MS = 25_000;
const EXPLANATION_TIMEOUT_MS = 30_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function candidateInstruction(mode: AnalysisMode): string {
  if (mode === "best") {
    return [
      "Task: build the strongest possible deck from this player's collection.",
      "Ignore the current deck except as context. Choose the archetype that best suits the cards and levels available.",
    ].join("\n");
  }
  return [
    "Task: improve this player's current deck with the smallest effective change.",
    "Change at most three cards. Keep the deck's identity and archetype unless it is fundamentally broken.",
    "If the current deck is already strong, return it unchanged.",
  ].join("\n");
}

async function generateOneCandidate(
  config: AiModelConfig,
  engine: EngineContext,
  brief: string,
): Promise<DeckCandidate | null> {
  try {
    const { object } = await withTimeout(
      generateObject({
        model: instantiateModel(config),
        schema: deckCandidateSchema,
        schemaName: "clashDeckCandidate",
        schemaDescription: "A single legal Clash Royale deck for this player.",
        temperature: 0.4,
        maxOutputTokens: 1_200,
        system: [
          "You are an expert Clash Royale deck builder.",
          "Return only a deck of exactly 8 card names, the archetype it plays as, and a short rationale.",
          "Every card must appear verbatim in the player's owned card list.",
          "Respect the deck construction rules exactly; an illegal deck is discarded.",
        ].join("\n"),
        prompt: `${candidateInstruction(engine.mode)}\n\n${brief}`,
      }),
      CANDIDATE_TIMEOUT_MS,
      `candidate generation via ${config.label}`,
    );

    return { modelLabel: config.label, ...object };
  } catch (error) {
    console.warn("[clash-deck-advisor] candidate generation failed", {
      model: config.label,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

/**
 * Asks every configured provider for a deck at the same time.
 *
 * Different models favour different archetypes, so generating in parallel and
 * ranking the results locally produces a better deck than trusting whichever
 * single model happened to answer.
 */
async function generateCandidates(
  engine: EngineContext,
  brief: string,
): Promise<{ candidates: DeckCandidate[]; requested: number }> {
  const models = getCandidateModels();
  const results = await Promise.all(
    models.map((config) => generateOneCandidate(config, engine, brief)),
  );

  return {
    candidates: results.filter((entry): entry is DeckCandidate => entry !== null),
    requested: models.length,
  };
}

/**
 * Explains the chosen deck, preferring a model that did not propose it so the
 * write-up is a second opinion rather than self-justification.
 */
async function explainDeck(
  engine: EngineContext,
  winner: RankedCandidate,
  chosenScore: DeckScore,
): Promise<{ explanation: DeckExplanation; modelLabel: string }> {
  const chain = getAiModelChain();
  const reviewers = [
    ...chain.filter((config) => config.label !== winner.modelLabel),
    ...chain,
  ];

  const swaps = diffDecks(
    engine.currentDeck.map((card) => card.name),
    winner.deck,
  );
  const reviewBrief = buildExplanationBrief(
    engine,
    winner.profiles,
    chosenScore,
    winner.archetype,
    swaps,
  );

  let lastError: unknown;

  for (const config of reviewers) {
    try {
      const { object } = await withTimeout(
        generateObject({
          model: instantiateModel(config),
          schema: deckExplanationSchema,
          schemaName: "clashDeckExplanation",
          schemaDescription:
            "Coaching notes explaining an already-decided Clash Royale deck.",
          temperature: 0.3,
          maxOutputTokens: 4_000,
          system: [
            "You are an expert Clash Royale coach reviewing a deck decision that has already been made.",
            "Do not propose a different deck. Explain the deck you are given.",
            "Give one reason per changed card, naming the incoming card.",
            "Keep every reason, problem, and summary to a single sentence.",
            "Ground replay advice in the supplied recent losses. Do not invent match events.",
            "Return exactly five matchup assessments against broad archetypes.",
            "Only list genuine problems; an empty problems array is valid.",
          ].join("\n"),
          prompt: reviewBrief,
        }),
        EXPLANATION_TIMEOUT_MS,
        `explanation via ${config.label}`,
      );

      return { explanation: object, modelLabel: config.label };
    } catch (error) {
      lastError = error;
      console.warn("[clash-deck-advisor] explanation attempt failed", {
        model: config.label,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All explanation attempts failed");
}

/** Converts the local score into the 0-100 dimensions the UI renders. */
function toWeaknessScores(score: DeckScore): DeckAnalysis["weaknessScores"] {
  const percent = (value: number) => Math.round(value * 100);
  return {
    airDefense: percent(score.components.airDefense),
    tankStopping: percent(score.components.tankAnswer),
    swarmControl: percent(score.components.splashAnswer),
    spellCoverage: percent(score.components.spellCoverage),
    cycle: percent(score.components.cycleSpeed),
    synergy: percent(
      (score.components.winCondition +
        score.components.specialSlots +
        score.components.elixirCurve) /
        3,
    ),
  };
}

function assembleAnalysis(
  engine: EngineContext,
  winner: RankedCandidate,
  chosenScore: DeckScore,
  explanation: DeckExplanation,
): DeckAnalysis {
  const originalDeck = engine.currentDeck.map((card) => card.name);
  const swaps = diffDecks(originalDeck, winner.deck);
  const reasonForCard = new Map(
    explanation.changeReasons.map((entry) => [entry.card, entry.reason]),
  );

  return {
    originalDeck,
    improvedDeck: winner.deck,
    verdict: swaps.length > 0 ? "improve" : "keep",
    verdictReason: explanation.verdictReason,
    problems: explanation.problems,
    changes: swaps.map((swap) => ({
      out: swap.out,
      in: swap.in,
      reason:
        reasonForCard.get(swap.in) ??
        `Upgrades the slot held by ${swap.out}.`,
    })),
    metaTier: explanation.metaTier,
    matchups: explanation.matchups,
    replayAdvice: explanation.replayAdvice,
    weaknessScores: toWeaknessScores(chosenScore),
    strategy: explanation.strategy,
    averageElixir: averageElixir(winner.profiles),
  };
}

/**
 * Falls back to the current deck when no model produced a legal candidate, so
 * the player still gets coaching rather than an error page.
 */
function currentDeckAsCandidate(engine: EngineContext): RankedCandidate {
  return {
    modelLabel: "none",
    deck: engine.currentDeck.map((card) => card.name),
    archetype: "Current deck",
    rationale: "No legal candidate was produced, so the current deck stands.",
    profiles: engine.currentDeck,
    score: engine.currentScore,
  };
}

export async function runDeckEngine(
  engine: EngineContext,
): Promise<EngineResult> {
  const brief = buildGenerationBrief(engine);
  const { candidates, requested } = await generateCandidates(engine, brief);
  const ranked = rankCandidates(candidates, engine.ownedCards);

  const { winner, keptCurrentDeck, discardedForTooManySwaps } = selectWinner(
    ranked.accepted,
    currentDeckAsCandidate(engine),
    engine.mode,
  );

  const chosenScore = scoreDeck(winner.profiles);
  const { explanation, modelLabel } = await explainDeck(
    engine,
    winner,
    chosenScore,
  );

  return {
    analysis: assembleAnalysis(engine, winner, chosenScore, explanation),
    diagnostics: {
      candidatesRequested: requested,
      candidatesAccepted: ranked.accepted.length,
      candidatesRejected: ranked.rejected.map((entry) => ({
        modelLabel: entry.modelLabel,
        reason: entry.reason,
      })),
      winningModel: winner.modelLabel,
      explanationModel: modelLabel,
      currentScore: engine.currentScore.total,
      chosenScore: chosenScore.total,
      keptCurrentDeck,
      discardedForTooManySwaps,
    },
  };
}
