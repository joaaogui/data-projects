import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const brawlerName = nonEmptyText;
const trophies = z.number().int().min(0);

export const accountHealthSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    verdict: nonEmptyText,
  })
  .strict();

export const upgradePrioritySchema = z
  .object({
    brawlerName,
    currentPower: z.number().int().min(1).max(11),
    currentTrophies: trophies,
    accountImpact: z.enum(["high", "medium", "low"]),
    reason: nonEmptyText,
  })
  .strict();

export const pushTargetSchema = z
  .object({
    brawlerName,
    currentTrophies: trophies,
    targetTrophies: trophies,
    reason: nonEmptyText,
  })
  .strict();

export const buildAdviceSchema = z
  .object({
    brawlerName,
    gadget: nonEmptyText.nullable(),
    starPower: nonEmptyText.nullable(),
    gears: z.array(nonEmptyText).max(2),
    hypercharge: nonEmptyText.nullable(),
    reason: nonEmptyText,
  })
  .strict();

export const battleDiagnosisSchema = z
  .object({
    brawlerName,
    mode: nonEmptyText,
    map: nonEmptyText.nullable(),
    outcome: z.enum(["strength", "concern", "mixed"]),
    summary: nonEmptyText,
    adjustment: nonEmptyText,
  })
  .strict();

export const avoidInvestmentSchema = z
  .object({
    brawlerName,
    reason: nonEmptyText,
  })
  .strict();

export const actionStepSchema = z
  .object({
    title: nonEmptyText,
    detail: nonEmptyText,
  })
  .strict();

export const accountCoachSchema = z
  .object({
    health: accountHealthSchema,
    upgradePriorities: z.array(upgradePrioritySchema).max(5),
    pushTargets: z.array(pushTargetSchema).max(5),
    buildAdvice: z.array(buildAdviceSchema).max(5),
    battleDiagnosis: z.array(battleDiagnosisSchema).max(6),
    avoidForNow: z.array(avoidInvestmentSchema).max(5),
    actionPlan: z.array(actionStepSchema).length(3),
  })
  .strict();

export type AccountHealth = z.infer<typeof accountHealthSchema>;
export type UpgradePriority = z.infer<typeof upgradePrioritySchema>;
export type PushTarget = z.infer<typeof pushTargetSchema>;
export type BuildAdvice = z.infer<typeof buildAdviceSchema>;
export type BattleDiagnosis = z.infer<typeof battleDiagnosisSchema>;
export type AvoidInvestment = z.infer<typeof avoidInvestmentSchema>;
export type ActionStep = z.infer<typeof actionStepSchema>;
export type AccountCoachAnalysis = z.infer<typeof accountCoachSchema>;
