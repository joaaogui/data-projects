import { describe, expect, it, vi } from "vitest";

import {
  AiProvidersExhaustedError,
  getAiModelChain,
  getAiProviderOptions,
  getAiProviderConfig,
  runWithAiFallback,
} from "./ai-provider";

const bothProviders = {
  GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
  GROQ_API_KEY: "groq-key",
};

describe("getAiProviderConfig", () => {
  it("prefers the fast Gemini model when both providers are configured", () => {
    expect(getAiProviderConfig(bothProviders)).toEqual({
      provider: "google",
      apiKey: "google-key",
      model: "gemini-3.5-flash-lite",
      label: "gemini-3.5-flash-lite",
    });
  });

  it("uses Groq when Google is unavailable", () => {
    expect(getAiProviderConfig({ GROQ_API_KEY: "groq-key" })).toEqual({
      provider: "groq",
      apiKey: "groq-key",
      model: "openai/gpt-oss-120b",
      label: "openai/gpt-oss-120b",
    });
  });
});

describe("getAiModelChain", () => {
  it("switches providers before trying the second Gemini model", () => {
    expect(getAiModelChain(bothProviders).map((model) => model.label)).toEqual([
      "gemini-3.5-flash-lite",
      "openai/gpt-oss-120b",
      "gemini-3.6-flash",
    ]);
  });

  it("retains both Gemini models when Groq is unavailable", () => {
    expect(
      getAiModelChain({
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }).map((model) => model.label),
    ).toEqual(["gemini-3.5-flash-lite", "gemini-3.6-flash"]);
  });

  it("rejects an environment with no configured provider", () => {
    expect(() => getAiModelChain({})).toThrow(
      "GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY",
    );
  });
});

describe("getAiProviderOptions", () => {
  it("uses minimal Gemini thinking for latency-sensitive analysis", () => {
    expect(
      getAiProviderOptions(getAiProviderConfig(bothProviders)),
    ).toEqual({
      google: {
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
    });
  });

  it("does not send Google options to Groq", () => {
    expect(
      getAiProviderOptions(
        getAiProviderConfig({ GROQ_API_KEY: "groq-key" }),
      ),
    ).toBeUndefined();
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

  it("falls through provider and schema failures in chain order", async () => {
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
        throw Object.assign(new Error("invalid structured output"), {
          name: "AI_NoObjectGeneratedError",
        });
      }
      return "analysis";
    }, bothProviders);

    expect(result).toBe("analysis");
    expect(attempted).toEqual([
      "gemini-3.5-flash-lite",
      "openai/gpt-oss-120b",
      "gemini-3.6-flash",
    ]);
  });

  it("throws a safe aggregate error after every model fails", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("provider details");
    });

    const promise = runWithAiFallback(attempt, bothProviders);

    await expect(promise).rejects.toBeInstanceOf(AiProvidersExhaustedError);
    await expect(promise).rejects.toMatchObject({
      message: "All configured AI providers failed",
      attempts: [
        { provider: "google", model: "gemini-3.5-flash-lite" },
        { provider: "groq", model: "openai/gpt-oss-120b" },
        { provider: "google", model: "gemini-3.6-flash" },
      ],
    });
    await expect(promise).rejects.not.toHaveProperty(
      "message",
      expect.stringContaining("provider details"),
    );
  });
});
