import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export interface AiEnvironment {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

export type AiProviderName = "google" | "groq";

export interface AiProviderConfig {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  label: string;
}

export interface AiAttemptFailure {
  provider: AiProviderName;
  model: string;
  errorType: string;
  statusCode?: number;
  retryable?: boolean;
}

export class MissingAiConfigurationError extends Error {
  constructor() {
    super(
      "Missing required server configuration: GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
    this.name = "MissingAiConfigurationError";
  }
}

export class AiProvidersExhaustedError extends Error {
  readonly attempts: readonly AiAttemptFailure[];

  constructor(attempts: readonly AiAttemptFailure[], cause: unknown) {
    super("All configured AI providers failed", { cause });
    this.name = "AiProvidersExhaustedError";
    this.attempts = attempts;
  }
}

const GOOGLE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"] as const;
const GROQ_MODEL = "openai/gpt-oss-120b";

function processEnvironment(): AiEnvironment {
  return {
    GOOGLE_GENERATIVE_AI_API_KEY:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  };
}

function googleConfig(apiKey: string, model: string): AiProviderConfig {
  return {
    provider: "google",
    apiKey,
    model,
    label: model,
  };
}

function groqConfig(apiKey: string): AiProviderConfig {
  return {
    provider: "groq",
    apiKey,
    model: GROQ_MODEL,
    label: GROQ_MODEL,
  };
}

export function getAiModelChain(
  environment: AiEnvironment = processEnvironment(),
): AiProviderConfig[] {
  const googleKey =
    environment.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const groqKey = environment.GROQ_API_KEY?.trim();
  const models: AiProviderConfig[] = [];

  if (googleKey) {
    models.push(googleConfig(googleKey, GOOGLE_MODELS[0]));
  }
  if (groqKey) {
    models.push(groqConfig(groqKey));
  }
  if (googleKey) {
    models.push(googleConfig(googleKey, GOOGLE_MODELS[1]));
  }

  if (models.length === 0) {
    throw new MissingAiConfigurationError();
  }

  return models;
}

export function getAiProviderConfig(
  environment: AiEnvironment = processEnvironment(),
): AiProviderConfig {
  return getAiModelChain(environment)[0];
}

export function getAiProviderOptions(config: AiProviderConfig) {
  if (config.provider !== "google") {
    return undefined;
  }

  return {
    google: {
      thinkingConfig: {
        thinkingLevel: "minimal" as const,
      },
    },
  };
}

export function instantiateModel(config: AiProviderConfig): LanguageModel {
  if (config.provider === "google") {
    return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
  }
  return createGroq({ apiKey: config.apiKey })(config.model);
}

function failureFor(
  config: AiProviderConfig,
  error: unknown,
): AiAttemptFailure {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as {
          name?: unknown;
          statusCode?: unknown;
          isRetryable?: unknown;
        })
      : undefined;

  return {
    provider: config.provider,
    model: config.model,
    errorType:
      typeof candidate?.name === "string"
        ? candidate.name
        : error instanceof Error
          ? error.name
          : "UnknownError",
    ...(typeof candidate?.statusCode === "number"
      ? { statusCode: candidate.statusCode }
      : {}),
    ...(typeof candidate?.isRetryable === "boolean"
      ? { retryable: candidate.isRetryable }
      : {}),
  };
}

export async function runWithAiFallback<T>(
  attempt: (config: AiProviderConfig) => Promise<T>,
  environment: AiEnvironment = processEnvironment(),
  onFailure?: (failure: AiAttemptFailure) => void,
): Promise<T> {
  const failures: AiAttemptFailure[] = [];
  let lastError: unknown;

  for (const config of getAiModelChain(environment)) {
    try {
      return await attempt(config);
    } catch (error) {
      lastError = error;
      const failure = failureFor(config, error);
      failures.push(failure);
      onFailure?.(failure);
    }
  }

  throw new AiProvidersExhaustedError(failures, lastError);
}

export function createAiModel(
  environment: AiEnvironment = processEnvironment(),
): LanguageModel {
  return instantiateModel(getAiProviderConfig(environment));
}
