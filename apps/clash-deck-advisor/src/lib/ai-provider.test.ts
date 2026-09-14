import { describe, expect, it } from "vitest";

import { getAiProviderConfig } from "./ai-provider";

describe("getAiProviderConfig", () => {
  it("prefers Groq when both providers are configured", () => {
    expect(
      getAiProviderConfig({
        GROQ_API_KEY: "groq-key",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }),
    ).toEqual({
      provider: "groq",
      apiKey: "groq-key",
      model: "openai/gpt-oss-120b",
    });
  });

  it("falls back to Google when Groq is unavailable", () => {
    expect(
      getAiProviderConfig({
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }),
    ).toEqual({
      provider: "google",
      apiKey: "google-key",
      model: "gemini-2.5-flash",
    });
  });

  it("rejects missing AI configuration", () => {
    expect(() => getAiProviderConfig({})).toThrow(
      "Missing required server configuration: GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY",
    );
  });
});
