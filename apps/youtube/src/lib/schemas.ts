import { z } from "zod";

export const aiQuerySchema = z.object({
  question: z.string().min(1, "Question is required").max(500, "Question too long"),
  context: z.string().min(1, "Context is required"),
});

export const aiQueryMultiTurnSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1).max(100),
  context: z.string().max(200_000).optional().default(""),
});

export const sagaAssignSchema = z.object({
  action: z.enum(["assign", "unassign", "create"]),
  sagaId: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  name: z.string().optional(),
});

export const bulkRequestSchema = z.object({
  action: z.enum([
    "sync-videos",
    "sync-transcripts",
    "delete-transcripts",
    "delete-sagas",
    "delete-ai-sagas",
    "delete-videos",
    "delete-channel",
  ]),
  channelIds: z.array(z.string()).min(1, "channelIds required"),
});

export const cleanupSchema = z.object({
  action: z.enum([
    "delete-transcripts",
    "delete-sagas",
    "delete-ai-sagas",
    "delete-sync-jobs",
    "delete-videos",
    "delete-channel",
    "delete-suggestion-cache",
    "delete-completed-sync-jobs",
    "delete-null-transcripts",
  ]),
  channelId: z.string().optional(),
});

export const sagaAnalyzeSchema = z.object({
  videos: z
    .array(
      z.object({
        videoId: z.string(),
        title: z.string(),
        transcript: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
});

export const syncSchema = z.object({
  channelId: z.string().min(10, "Invalid channel ID"),
});
