import { describe, it, expect } from "vitest";
import {
  aiQuerySchema,
  sagaAssignSchema,
  bulkRequestSchema,
  cleanupSchema,
  sagaAnalyzeSchema,
  syncSchema,
} from "@/lib/schemas";

describe("aiQuerySchema", () => {
  it("accepts valid payload", () => {
    const result = aiQuerySchema.safeParse({
      question: "What videos perform best?",
      context: "Channel analytics data...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty question", () => {
    const result = aiQuerySchema.safeParse({ question: "", context: "ctx" });
    expect(result.success).toBe(false);
  });

  it("rejects missing context", () => {
    const result = aiQuerySchema.safeParse({ question: "test" });
    expect(result.success).toBe(false);
  });

  it("rejects question exceeding 500 characters", () => {
    const result = aiQuerySchema.safeParse({
      question: "x".repeat(501),
      context: "ctx",
    });
    expect(result.success).toBe(false);
  });

  it("accepts question exactly at 500 characters", () => {
    const result = aiQuerySchema.safeParse({
      question: "x".repeat(500),
      context: "c",
    });
    expect(result.success).toBe(true);
  });
});

describe("sagaAssignSchema", () => {
  it("accepts assign action with sagaId and videoIds", () => {
    const result = sagaAssignSchema.safeParse({
      action: "assign",
      sagaId: "saga_1",
      videoIds: ["v1", "v2"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts unassign action", () => {
    const result = sagaAssignSchema.safeParse({ action: "unassign" });
    expect(result.success).toBe(true);
  });

  it("accepts create action with name", () => {
    const result = sagaAssignSchema.safeParse({
      action: "create",
      name: "New Saga",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action value", () => {
    const result = sagaAssignSchema.safeParse({ action: "delete" });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = sagaAssignSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("bulkRequestSchema", () => {
  it("accepts valid payload", () => {
    const result = bulkRequestSchema.safeParse({
      action: "sync",
      channelIds: ["ch1", "ch2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty action", () => {
    const result = bulkRequestSchema.safeParse({
      action: "",
      channelIds: ["ch1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty channelIds array", () => {
    const result = bulkRequestSchema.safeParse({
      action: "sync",
      channelIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing channelIds", () => {
    const result = bulkRequestSchema.safeParse({ action: "sync" });
    expect(result.success).toBe(false);
  });
});

describe("cleanupSchema", () => {
  it("accepts valid payload with channelId", () => {
    const result = cleanupSchema.safeParse({
      action: "delete",
      channelId: "ch_123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional channelId", () => {
    const result = cleanupSchema.safeParse({ action: "purge" });
    expect(result.success).toBe(true);
  });

  it("rejects empty action", () => {
    const result = cleanupSchema.safeParse({ action: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = cleanupSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("sagaAnalyzeSchema", () => {
  it("accepts valid payload with 1 video", () => {
    const result = sagaAnalyzeSchema.safeParse({
      videos: [{ videoId: "v1", title: "Test" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts video with optional transcript", () => {
    const result = sagaAnalyzeSchema.safeParse({
      videos: [{ videoId: "v1", title: "Test", transcript: "Hello world" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty videos array", () => {
    const result = sagaAnalyzeSchema.safeParse({ videos: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 videos", () => {
    const videos = Array.from({ length: 51 }, (_, i) => ({
      videoId: `v${i}`,
      title: `Video ${i}`,
    }));
    const result = sagaAnalyzeSchema.safeParse({ videos });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 50 videos", () => {
    const videos = Array.from({ length: 50 }, (_, i) => ({
      videoId: `v${i}`,
      title: `Video ${i}`,
    }));
    const result = sagaAnalyzeSchema.safeParse({ videos });
    expect(result.success).toBe(true);
  });

  it("rejects video missing videoId", () => {
    const result = sagaAnalyzeSchema.safeParse({
      videos: [{ title: "Test" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects video missing title", () => {
    const result = sagaAnalyzeSchema.safeParse({
      videos: [{ videoId: "v1" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("syncSchema", () => {
  it("accepts valid channel ID", () => {
    const result = syncSchema.safeParse({ channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw" });
    expect(result.success).toBe(true);
  });

  it("rejects channel ID shorter than 10 characters", () => {
    const result = syncSchema.safeParse({ channelId: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts channel ID exactly 10 characters", () => {
    const result = syncSchema.safeParse({ channelId: "1234567890" });
    expect(result.success).toBe(true);
  });

  it("rejects missing channelId", () => {
    const result = syncSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
