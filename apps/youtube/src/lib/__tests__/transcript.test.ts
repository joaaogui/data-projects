import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("youtube-transcript-api-js", () => {
  const MockApi = vi.fn();
  MockApi.prototype.fetch = vi.fn();
  return { YouTubeTranscriptApi: MockApi };
});

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("../utils", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  runWorkerPool: vi.fn().mockResolvedValue(undefined),
}));

import {
  fetchFullTranscriptWithStatus,
  fetchFullTranscript,
  fetchTranscriptExcerpt,
  fetchTranscriptBatch,
} from "../transcript";
import { YouTubeTranscriptApi } from "youtube-transcript-api-js";
import { runWorkerPool } from "../utils";

const mockFetch = YouTubeTranscriptApi.prototype.fetch as ReturnType<
  typeof vi.fn
>;

describe("transcript", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runWorkerPool).mockResolvedValue(undefined);
  });

  describe("fetchFullTranscriptWithStatus", () => {
    it("returns ok with joined snippet text", async () => {
      mockFetch.mockResolvedValueOnce({
        snippets: [{ text: "Hello" }, { text: "World" }],
        languageCode: "en",
      });

      const result = await fetchFullTranscriptWithStatus("vid1");
      expect(result).toEqual({
        status: "ok",
        data: {
          fullText: "Hello World",
          excerpt: "Hello World",
          language: "en",
        },
      });
    });

    it("returns no_captions when snippets are empty", async () => {
      mockFetch.mockResolvedValueOnce({ snippets: [], languageCode: "en" });
      expect(await fetchFullTranscriptWithStatus("vid2")).toEqual({
        status: "no_captions",
      });
    });

    it("classifies 'Subtitles are disabled' as no_captions", async () => {
      mockFetch.mockRejectedValueOnce(
        new Error("Subtitles are disabled for this video")
      );
      expect((await fetchFullTranscriptWithStatus("vid3")).status).toBe(
        "no_captions"
      );
    });

    it("classifies 'not available' as no_captions", async () => {
      mockFetch.mockRejectedValueOnce(
        new Error("Transcript not available")
      );
      expect((await fetchFullTranscriptWithStatus("vid4")).status).toBe(
        "no_captions"
      );
    });

    it("classifies 'No transcript' as no_captions", async () => {
      mockFetch.mockRejectedValueOnce(new Error("No transcript found"));
      expect((await fetchFullTranscriptWithStatus("vid5")).status).toBe(
        "no_captions"
      );
    });

    it("retries on bot detection then succeeds", async () => {
      mockFetch
        .mockRejectedValueOnce(
          new Error("Sign in to confirm you're not a bot")
        )
        .mockRejectedValueOnce(
          new Error("Sign in to confirm you're not a bot")
        )
        .mockResolvedValueOnce({
          snippets: [{ text: "Recovered" }],
          languageCode: "pt",
        });

      const result = await fetchFullTranscriptWithStatus("vid6");
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.data.fullText).toBe("Recovered");
        expect(result.data.language).toBe("pt");
      }
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns error after exhausting all bot detection retries", async () => {
      const botMsg = "Sign in to confirm you're not a bot";
      for (let i = 0; i < 5; i++)
        mockFetch.mockRejectedValueOnce(new Error(botMsg));

      const result = await fetchFullTranscriptWithStatus("vid7");
      expect(result).toEqual({ status: "error", reason: botMsg });
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it("does not retry unknown errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      expect(await fetchFullTranscriptWithStatus("vid8")).toEqual({
        status: "error",
        reason: "Network timeout",
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("trims excerpt to excerptMaxChars", async () => {
      const longText = "A".repeat(500);
      mockFetch.mockResolvedValueOnce({
        snippets: [{ text: longText }],
        languageCode: "en",
      });

      const result = await fetchFullTranscriptWithStatus("vid9", 100);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.data.excerpt.length).toBeLessThanOrEqual(100);
        expect(result.data.fullText).toBe(longText);
      }
    });

    it("falls back to 'unknown' when languageCode is missing", async () => {
      mockFetch.mockResolvedValueOnce({ snippets: [{ text: "Text" }] });

      const result = await fetchFullTranscriptWithStatus("vid10");
      expect(result.status).toBe("ok");
      if (result.status === "ok") expect(result.data.language).toBe("unknown");
    });
  });

  describe("fetchFullTranscript", () => {
    it("returns TranscriptResult on success", async () => {
      mockFetch.mockResolvedValueOnce({
        snippets: [{ text: "Test transcript" }],
        languageCode: "pt",
      });

      expect(await fetchFullTranscript("vid11")).toEqual({
        fullText: "Test transcript",
        excerpt: "Test transcript",
        language: "pt",
      });
    });

    it("returns null on no_captions", async () => {
      mockFetch.mockRejectedValueOnce(
        new Error("Subtitles are disabled")
      );
      expect(await fetchFullTranscript("vid12")).toBeNull();
    });

    it("returns null on unknown error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("something"));
      expect(await fetchFullTranscript("vid13")).toBeNull();
    });
  });

  describe("fetchTranscriptExcerpt", () => {
    it("returns excerpt truncated to maxChars", async () => {
      mockFetch.mockResolvedValueOnce({
        snippets: [{ text: "B".repeat(2000) }],
        languageCode: "en",
      });

      const result = await fetchTranscriptExcerpt("vid14", 150);
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(150);
    });

    it("returns null on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      expect(await fetchTranscriptExcerpt("vid15")).toBeNull();
    });
  });

  describe("fetchTranscriptBatch", () => {
    it("delegates to runWorkerPool with correct options", async () => {
      const ids = ["a", "b", "c"];
      const result = await fetchTranscriptBatch(ids, 500);

      expect(runWorkerPool).toHaveBeenCalledWith(ids, expect.any(Function), {
        concurrency: 8,
        gapMs: 100,
        staggerMs: 500,
      });
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });
});
