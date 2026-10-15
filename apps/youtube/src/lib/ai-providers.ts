import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env } from "./env";

export function getModel(): LanguageModel {
  const googleApiKey =
    env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_AI_API_KEY;
  if (googleApiKey) {
    const google = createGoogleGenerativeAI({
      apiKey: googleApiKey,
    });
    return google("gemini-3.5-flash-lite");
  }

  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    return groq("openai/gpt-oss-120b");
  }

  throw new Error(
    "No AI provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY, or GROQ_API_KEY."
  );
}
