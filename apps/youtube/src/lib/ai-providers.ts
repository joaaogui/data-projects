import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
  if (process.env.GOOGLE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
    return google("gemini-2.0-flash");
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    return groq("llama-3.1-8b-instant");
  }

  throw new Error(
    "No AI provider configured. Set GOOGLE_AI_API_KEY or GROQ_API_KEY."
  );
}
