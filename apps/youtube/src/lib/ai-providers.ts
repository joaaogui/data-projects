import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env } from "./env";

export function getModel(): LanguageModel {
  if (env.GOOGLE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_AI_API_KEY,
    });
    return google("gemini-2.0-flash");
  }

  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    return groq("llama-3.1-8b-instant");
  }

  throw new Error(
    "No AI provider configured. Set GOOGLE_AI_API_KEY or GROQ_API_KEY."
  );
}
