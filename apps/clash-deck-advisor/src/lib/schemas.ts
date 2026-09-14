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

export const deckAnalysisSchema = z.object({
  originalDeck: z.array(nonEmptyText).length(8),
  improvedDeck: z.array(nonEmptyText).length(8),
  verdict: z.enum(["keep", "improve"]),
  verdictReason: nonEmptyText,
  problems: z.array(deckProblemSchema).max(4),
  changes: z.array(cardSwapSchema).max(3),
  metaTier: metaTierSchema,
  matchups: z.array(matchupSchema).length(5),
  replayAdvice: z.array(replayAdviceSchema).max(3),
  weaknessScores: weaknessScoresSchema,
  strategy: nonEmptyText,
  averageElixir: z.number().min(0).max(10),
});

export type DeckAnalysis = z.infer<typeof deckAnalysisSchema>;
export type DeckProblem = z.infer<typeof deckProblemSchema>;
export type CardSwap = z.infer<typeof cardSwapSchema>;
export type MetaTier = z.infer<typeof metaTierSchema>;
export type Matchup = z.infer<typeof matchupSchema>;
export type ReplayAdvice = z.infer<typeof replayAdviceSchema>;
export type WeaknessScores = z.infer<typeof weaknessScoresSchema>;
