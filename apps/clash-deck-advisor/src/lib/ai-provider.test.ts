import { describe, expect, it, vi } from "vitest";

import {
  AiProvidersExhaustedError,
  getAiModelChain,
  getAiProviderConfig,
  getCandidateModels,
  runWithAiFallback,
} from "./ai-provider";

const bothProviders = {
  GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
  GROQ_API_KEY: "groq-key",
};

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
      model: "gemini-3.5-flash-lite",
      label: "gemini-3.5-flash-lite",
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
      label: "openai/gpt-oss-120b",
    });
  });

  it("rejects missing AI configuration", () => {
    expect(() => getAiProviderConfig({})).toThrow(
      "Missing required server configuration: GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
  });
});

describe("getAiModelChain", () => {
  it("alternates providers so a retry avoids the saturated backend", () => {
    const chain = getAiModelChain({
      GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      GROQ_API_KEY: "groq-key",
    });

    expect(chain.map((entry) => entry.label)).toEqual([
      "gemini-3.5-flash-lite",
      "openai/gpt-oss-120b",
      "gemini-3.6-flash",
    ]);
  });

  it("still offers a Gemini fallback when only Google is configured", () => {
    const chain = getAiModelChain({
      GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
    });

    expect(chain.map((entry) => entry.label)).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
    ]);
  });

  it("rejects missing AI configuration", () => {
    expect(() => getAiModelChain({})).toThrow(
      "Missing required server configuration",
    );
  });
});

describe("getCandidateModels", () => {
  it("uses one model per provider so proposals differ", () => {
    const models = getCandidateModels({
      GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      GROQ_API_KEY: "groq-key",
    });

    expect(models.map((entry) => entry.provider)).toEqual(["google", "groq"]);
  });

  it("degrades to a single model when only one provider is configured", () => {
    expect(
      getCandidateModels({ GROQ_API_KEY: "groq-key" }).map(
        (entry) => entry.provider,
      ),
    ).toEqual(["groq"]);
  });
});

describe("runWithAiFallback", () => {
  it("returns the primary result without calling a fallback", async () => {
    const attempt = vi.fn(async (model: { label: string }) => model.label);

    await expect(runWithAiFallback(attempt, bothProviders)).resolves.toBe(
      "gemini-3.5-flash-lite",
    );
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("falls through provider failures in chain order", async () => {
    const attempted: string[] = [];

    const result = await runWithAiFallback(async (model) => {
      attempted.push(model.label);
      if (model.label === "gemini-3.5-flash-lite") {
        throw Object.assign(new Error("overloaded"), {
          statusCode: 503,
          isRetryable: true,
        });
      }
      if (model.provider === "groq") {
        throw new Error("ungrounded output");
      }
      return "polished";
    }, bothProviders);

    expect(result).toBe("polished");
    expect(attempted).toEqual([
      "gemini-3.5-flash-lite",
      "openai/gpt-oss-120b",
      "gemini-3.6-flash",
    ]);
  });

  it("throws AiProvidersExhaustedError after every model fails", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("provider failure");
    });

    await expect(runWithAiFallback(attempt, bothProviders)).rejects.toBeInstanceOf(
      AiProvidersExhaustedError,
    );
  });
});
