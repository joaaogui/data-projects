import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

interface AiEnvironment {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

type AiProviderConfig =
  | {
      provider: "google";
      apiKey: string;
      model: "gemini-3.6-flash";
    }
  | {
      provider: "groq";
      apiKey: string;
      model: "openai/gpt-oss-120b";
    };

export class MissingAiConfigurationError extends Error {
  constructor() {
    super(
      "Missing required server configuration: GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
    this.name = "MissingAiConfigurationError";
  }
}

export function getAiProviderConfig(
  environment: AiEnvironment,
): AiProviderConfig {
  const googleKey = environment.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (googleKey) {
    return {
      provider: "google",
      apiKey: googleKey,
      model: "gemini-3.6-flash",
    };
  }

  const groqKey = environment.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      model: "openai/gpt-oss-120b",
    };
  }

  throw new MissingAiConfigurationError();
}

export function createAiModel(
  environment: AiEnvironment = {
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
): LanguageModel {
  const config = getAiProviderConfig(environment);

  if (config.provider === "google") {
    return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
  }

  return createGroq({ apiKey: config.apiKey })(config.model);
}
