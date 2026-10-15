import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const score = z.number().min(0).max(100);

export const deckProblemSchema = z.object({
  title: nonEmptyText,
  description: nonEmptyText,
  severity: z.enum(["high", "medium", "low"]),
});

export const cardSwapSchema = z.object({
  out: nonEmptyText,
  in: nonEmptyText,
  reason: nonEmptyText,
  counterTargets: z.array(nonEmptyText).max(4).optional(),
});

export const metaTierSchema = z.object({
  archetype: nonEmptyText,
  tier: z.enum(["S", "A", "B", "C", "D"]),
  summary: nonEmptyText,
});

export const matchupSchema = z.object({
  archetype: nonEmptyText,
  rating: z.enum(["favored", "even", "unfavored"]),
  advice: nonEmptyText,
});

export const replayAdviceSchema = z.object({
  title: nonEmptyText,
  detail: nonEmptyText,
});

export const weaknessScoresSchema = z.object({
  airDefense: score,
  tankStopping: score,
  swarmControl: score,
  spellCoverage: score,
  cycle: score,
  synergy: score,
});

/** A deck proposed during candidate generation, before local validation. */
export const deckCandidateSchema = z.object({
  deck: z.array(nonEmptyText).length(8),
  archetype: nonEmptyText,
  rationale: nonEmptyText,
});

/**
 * The prose half of an analysis.
 *
 * Deck contents, swaps, and strength scores are all derived locally, so the
 * model is only asked for the judgement and explanation it is actually good
 * at. That removes any chance of the narrative contradicting the deck.
 */
export const deckExplanationSchema = z.object({
  verdictReason: nonEmptyText,
  problems: z.array(deckProblemSchema).max(4),
  // Building the best deck from a collection can replace the whole list, so
  // the cap is a full deck rather than the three swaps an improvement allows.
  changeReasons: z
    .array(z.object({ card: nonEmptyText, reason: nonEmptyText }))
    .max(8),
  metaTier: metaTierSchema,
  matchups: z.array(matchupSchema).length(5),
  replayAdvice: z.array(replayAdviceSchema).max(3),
  strategy: nonEmptyText,
});

export const deckEvidenceSchema = z.object({
  archetypeId: nonEmptyText,
  archetypeName: nonEmptyText,
  source: nonEmptyText,
  confidence: z.enum(["high", "medium", "low"]),
  levelReadiness: score,
  strengths: z.array(nonEmptyText).max(4),
  weaknesses: z.array(nonEmptyText).max(4),
  liveMetaOverlap: z.number().int().min(0),
  counteredThreats: z.array(nonEmptyText).max(5).optional(),
  avoidedFailedSwaps: z.array(nonEmptyText).max(4).optional(),
});

export const storedSuggestionEntrySchema = z.object({
  id: nonEmptyText,
  createdAt: nonEmptyText,
  mode: z.enum(["improve", "best"]),
  baselineDeck: z.array(nonEmptyText).max(8),
  baselineWinRate: z.number().min(0).max(100),
  recommendedDeck: z.array(nonEmptyText).max(8),
  recommendedSwaps: z
    .array(
      z.object({
        out: nonEmptyText,
        in: nonEmptyText,
      }),
    )
    .max(8),
  archetypeName: nonEmptyText,
});

export const playerFeedbackInputSchema = z.object({
  lockedCards: z.array(nonEmptyText).max(8).default([]),
  excludedCards: z.array(nonEmptyText).max(20).default([]),
  suggestionHistory: z.array(storedSuggestionEntrySchema).max(25).default([]),
});

/** Roughly 300 x 450 bytes: about 135 KB in localStorage and on the wire. */
export const MAX_STORED_BATTLES = 300;

const cardName = nonEmptyText.max(40);

/**
 * The compact battle record the browser keeps between visits. Outcome, deck
 * key, archetype, and timestamp are recomputed on the server rather than
 * trusted from the client.
 */
export const storedBattleSchema = z.object({
  battleTime: nonEmptyText.max(32),
  type: z.string().max(64),
  gameModeName: z.string().max(64),
  playerCrowns: z.number().int().min(0).max(10),
  opponentCrowns: z.number().int().min(0).max(10),
  trophyChange: z.number().int().min(-1000).max(1000),
  playerDeck: z.array(cardName).length(8),
  opponentName: z.string().max(64),
  opponentTag: z.string().max(24),
  opponentDeck: z.array(cardName).length(8),
});

export const battleHistorySchema = z
  .array(storedBattleSchema)
  .max(MAX_STORED_BATTLES);

export const analysisRequestSchema = z.object({
  mode: z.enum(["improve", "best"]).default("improve"),
  refresh: z.boolean().default(false),
  feedback: playerFeedbackInputSchema.optional(),
  battleHistory: battleHistorySchema.default([]),
});

export const deckAnalysisSchema = z.object({
  originalDeck: z.array(nonEmptyText).length(8),
  improvedDeck: z.array(nonEmptyText).length(8),
  verdict: z.enum(["keep", "improve"]),
  verdictReason: nonEmptyText,
  problems: z.array(deckProblemSchema).max(4),
  changes: z.array(cardSwapSchema).max(8),
  metaTier: metaTierSchema,
  matchups: z.array(matchupSchema).max(5),
  replayAdvice: z.array(replayAdviceSchema).max(3),
  weaknessScores: weaknessScoresSchema,
  strategy: nonEmptyText,
  averageElixir: z.number().min(0).max(10),
  evidence: deckEvidenceSchema.optional(),
});

export type DeckAnalysis = z.infer<typeof deckAnalysisSchema>;
export type DeckEvidence = z.infer<typeof deckEvidenceSchema>;
export type DeckCandidateOutput = z.infer<typeof deckCandidateSchema>;
export type DeckExplanation = z.infer<typeof deckExplanationSchema>;
export type DeckProblem = z.infer<typeof deckProblemSchema>;
export type CardSwap = z.infer<typeof cardSwapSchema>;
export type MetaTier = z.infer<typeof metaTierSchema>;
export type Matchup = z.infer<typeof matchupSchema>;
export type ReplayAdvice = z.infer<typeof replayAdviceSchema>;
export type WeaknessScores = z.infer<typeof weaknessScoresSchema>;
export type StoredBattle = z.infer<typeof storedBattleSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
