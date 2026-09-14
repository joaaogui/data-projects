import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

interface AiEnvironment {
  GROQ_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
}

type AiProviderConfig =
  | {
      provider: "groq";
      apiKey: string;
      model: "openai/gpt-oss-120b";
    }
  | {
      provider: "google";
      apiKey: string;
      model: "gemini-2.5-flash";
    };

export class MissingAiConfigurationError extends Error {
  constructor() {
    super(
      "Missing required server configuration: GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY",
    );
    this.name = "MissingAiConfigurationError";
  }
}

export function getAiProviderConfig(
  environment: AiEnvironment,
): AiProviderConfig {
  const groqKey = environment.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      model: "openai/gpt-oss-120b",
    };
  }

  const googleKey = environment.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (googleKey) {
    return {
      provider: "google",
      apiKey: googleKey,
      model: "gemini-2.5-flash",
    };
  }

  throw new MissingAiConfigurationError();
}

export function createAiModel(
  environment: AiEnvironment = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
): LanguageModel {
  const config = getAiProviderConfig(environment);

  if (config.provider === "groq") {
    return createGroq({ apiKey: config.apiKey })(config.model);
  }

  return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
}
