import { describe, expect, it } from "vitest";

import { getAiProviderConfig } from "./ai-provider";

describe("getAiProviderConfig", () => {
  it("prefers Gemini when both providers are configured", () => {
    expect(
      getAiProviderConfig({
        GROQ_API_KEY: "groq-key",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }),
    ).toEqual({
      provider: "google",
      apiKey: "google-key",
      model: "gemini-3.6-flash",
    });
  });

  it("falls back to Groq when Gemini is unavailable", () => {
    expect(
      getAiProviderConfig({
        GROQ_API_KEY: "groq-key",
      }),
    ).toEqual({
      provider: "groq",
      apiKey: "groq-key",
      model: "openai/gpt-oss-120b",
    });
  });

  it("rejects missing AI configuration", () => {
    expect(() => getAiProviderConfig({})).toThrow(
      "Missing required server configuration: GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
  });
});
