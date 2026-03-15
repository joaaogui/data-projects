import type { FetchProgress, SyncLogEntry } from "@/types/youtube";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videos = pgTable(
  "videos",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    duration: integer("duration").notNull().default(0),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    likes: bigint("likes", { mode: "number" }).notNull().default(0),
    comments: bigint("comments", { mode: "number" }).notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    score: real("score").notNull().default(0),
    scoreComponents: jsonb("score_components").$type<{
      engagementScore: number;
      reachScore: number;
      momentumScore: number;
      efficiencyScore: number;
      communityScore: number;
    }>(),
    rates: jsonb("rates").$type<{
      likeRate: number;
      commentRate: number;
      engagementRate: number;
      viewsPerDay: number;
      viewsPerHour: number;
      viewsPerContentMin: number;
      engagementPerMinute: number;
    }>(),
    url: text("url").notNull(),
    thumbnail: text("thumbnail").notNull(),
    description: text("description").default(""),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("videos_channel_id_idx").on(table.channelId),
    index("videos_channel_published_idx").on(table.channelId, table.publishedAt),
  ]
);

export const transcripts = pgTable("transcripts", {
  videoId: text("video_id")
    .primaryKey()
    .references(() => videos.id, { onDelete: "cascade" }),
  fullText: text("full_text"),
  excerpt: text("excerpt"),
  language: text("language"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sagas = pgTable(
  "sagas",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").$type<"playlist" | "ai-detected" | "manual">().notNull(),
    playlistId: text("playlist_id"),
    videoIds: jsonb("video_ids").$type<string[]>().notNull().default([]),
    videoCount: integer("video_count").notNull().default(0),
    dateRange: jsonb("date_range").$type<{ first: string; last: string }>().notNull(),
    reasoning: text("reasoning"),
    videoEvidence: jsonb("video_evidence").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sagas_channel_id_idx").on(table.channelId)]
);

export const suggestionCache = pgTable("suggestion_cache", {
  query: text("query").primaryKey(),
  results: jsonb("results").$type<Array<{ channelId: string; channelTitle: string; thumbnails?: { default?: { url?: string } }; videoCount?: number }>>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    type: text("type").$type<"videos" | "transcripts" | "sagas">().notNull(),
    status: text("status")
      .$type<"pending" | "running" | "completed" | "failed">()
      .notNull()
      .default("pending"),
    progress: jsonb("progress").$type<FetchProgress>(),
    logs: jsonb("logs").$type<SyncLogEntry[]>().default([]),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sync_jobs_channel_id_idx").on(table.channelId),
    index("sync_jobs_status_idx").on(table.status),
    index("sync_jobs_channel_status_idx").on(table.channelId, table.status),
  ]
);
