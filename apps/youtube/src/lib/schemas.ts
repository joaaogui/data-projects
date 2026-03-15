import { z } from "zod";

export const aiQuerySchema = z.object({
  question: z.string().min(1, "Question is required").max(500, "Question too long"),
  context: z.string().min(1, "Context is required"),
});

export const sagaAssignSchema = z.object({
  action: z.enum(["assign", "unassign", "create"]),
  sagaId: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  name: z.string().optional(),
});

export const bulkRequestSchema = z.object({
  action: z.string().min(1),
  channelIds: z.array(z.string()).min(1, "channelIds required"),
});

export const cleanupSchema = z.object({
  action: z.string().min(1),
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
