import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export interface AiEnvironment {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

export type AiProviderName = "google" | "groq";

export interface AiModelConfig {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  /** Identifies the model in logs and in candidate attribution. */
  label: string;
}

export class MissingAiConfigurationError extends Error {
  constructor() {
    super(
      "Missing required server configuration: GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
    this.name = "MissingAiConfigurationError";
  }
}

/**
 * Google models in preference order.
 *
 * gemini-3.5-flash-lite is roughly twice as fast as gemini-3.6-flash on this
 * workload and returns valid structured output just as reliably, so it leads
 * for candidate generation. The heavier model stays as a fallback because the
 * lite tier sheds load under pressure.
 */
const GOOGLE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"] as const;
const GROQ_MODEL = "openai/gpt-oss-120b";

function googleConfigs(apiKey: string): AiModelConfig[] {
  return GOOGLE_MODELS.map((model) => ({
    provider: "google" as const,
    apiKey,
    model,
    label: model,
  }));
}

function groqConfig(apiKey: string): AiModelConfig {
  return { provider: "groq", apiKey, model: GROQ_MODEL, label: GROQ_MODEL };
}

function readEnvironment(environment: AiEnvironment) {
  return {
    googleKey: environment.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
    groqKey: environment.GROQ_API_KEY?.trim(),
  };
}

function processEnvironment(): AiEnvironment {
  return {
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  };
}

/**
 * Every usable model, ordered by preference.
 *
 * Interleaving providers matters: when a request fails because one provider is
 * overloaded, the next attempt should land somewhere else entirely rather than
 * on a sibling model behind the same saturated backend.
 */
export function getAiModelChain(
  environment: AiEnvironment = processEnvironment(),
): AiModelConfig[] {
  const { googleKey, groqKey } = readEnvironment(environment);
  const chain: AiModelConfig[] = [];

  if (googleKey) {
    const [primary, secondary] = googleConfigs(googleKey);
    chain.push(primary);
    if (groqKey) {
      chain.push(groqConfig(groqKey));
    }
    chain.push(secondary);
  } else if (groqKey) {
    chain.push(groqConfig(groqKey));
  }

  if (chain.length === 0) {
    throw new MissingAiConfigurationError();
  }

  return chain;
}

/**
 * Distinct models to generate candidate decks with, one per provider so the
 * proposals come from genuinely different reasoning rather than one model
 * sampled twice.
 */
export function getCandidateModels(
  environment: AiEnvironment = processEnvironment(),
): AiModelConfig[] {
  const { googleKey, groqKey } = readEnvironment(environment);
  const models: AiModelConfig[] = [];

  if (googleKey) {
    models.push(googleConfigs(googleKey)[0]);
  }
  if (groqKey) {
    models.push(groqConfig(groqKey));
  }

  if (models.length === 0) {
    throw new MissingAiConfigurationError();
  }

  return models;
}

export function getAiProviderConfig(
  environment: AiEnvironment = processEnvironment(),
): AiModelConfig {
  return getAiModelChain(environment)[0];
}

export function instantiateModel(config: AiModelConfig): LanguageModel {
  if (config.provider === "google") {
    return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
  }
  return createGroq({ apiKey: config.apiKey })(config.model);
}

export function createAiModel(
  environment: AiEnvironment = processEnvironment(),
): LanguageModel {
  return instantiateModel(getAiProviderConfig(environment));
}
