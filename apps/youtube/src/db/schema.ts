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
  subscriberCount: bigint("subscriber_count", { mode: "number" }),
  totalViewCount: bigint("total_view_count", { mode: "number" }),
  videoCount: integer("video_count"),
  customUrl: text("custom_url"),
  description: text("description"),
  country: text("country"),
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
    topics: jsonb("topics").$type<string[]>(),
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
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sagas_channel_id_idx").on(table.channelId),
    index("sagas_channel_source_idx").on(table.channelId, table.source),
  ]
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
    index("sync_jobs_cleanup_idx").on(table.channelId, table.type, table.status, table.updatedAt),
  ]
);

export const sagaCorrections = pgTable(
  "saga_corrections",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    action: text("action").$type<"assign" | "unassign" | "create">().notNull(),
    videoId: text("video_id").notNull(),
    videoTitle: text("video_title").notNull(),
    videoPublishedAt: timestamp("video_published_at", { withTimezone: true }).notNull(),
    targetSagaId: text("target_saga_id"),
    targetSagaName: text("target_saga_name"),
    previousSagaId: text("previous_saga_id"),
    previousSagaName: text("previous_saga_name"),
    neighborContext: jsonb("neighbor_context").$type<{
      leftSaga?: { id: string; name: string };
      rightSaga?: { id: string; name: string };
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("saga_corrections_channel_idx").on(table.channelId),
    index("saga_corrections_channel_date_idx").on(table.channelId, table.createdAt),
  ]
);

export const sharedReports = pgTable("shared_reports", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  channelTitle: text("channel_title").notNull(),
  snapshotData: jsonb("snapshot_data").$type<{
    videoCount: number;
    totalViews: number;
    avgScore: number;
    avgEngagement: number;
    scoreDistribution: number[];
    topPerformers: Array<{ title: string; score: number; views: number; thumbnail: string }>;
    cadenceLabel: string;
    createdBy: string;
  }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("comments_video_id_idx").on(table.videoId),
  ]
);

export const channelSnapshots = pgTable(
  "channel_snapshots",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    subscriberCount: bigint("subscriber_count", { mode: "number" }),
    viewCount: bigint("view_count", { mode: "number" }),
    videoCount: integer("video_count"),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("channel_snapshots_channel_idx").on(table.channelId),
    index("channel_snapshots_channel_date_idx").on(table.channelId, table.snapshotDate),
  ]
);

export const savedChannels = pgTable(
  "saved_channels",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    label: text("label"),
    pinned: integer("pinned").notNull().default(0),
    lastVisitedAt: timestamp("last_visited_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("saved_channels_user_idx").on(table.userId),
    index("saved_channels_user_channel_idx").on(table.userId, table.channelId),
  ]
);

export const sharedComparisons = pgTable("shared_comparisons", {
  id: text("id").primaryKey(),
  channelIds: jsonb("channel_ids").$type<string[]>().notNull(),
  channelTitles: jsonb("channel_titles").$type<string[]>().notNull(),
  snapshotData: jsonb("snapshot_data").$type<{
    channels: Array<{
      channelId: string;
      title: string;
      videoCount: number;
      avgScore: number;
      avgEngagement: number;
      totalViews: number;
      cadencePerWeek: number;
    }>;
  }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  plan: text("plan").$type<"free" | "pro" | "enterprise">().notNull().default("free"),
  syncQuotaDaily: integer("sync_quota_daily").notNull().default(10),
  syncUsageToday: integer("sync_usage_today").notNull().default(0),
  syncUsageResetAt: timestamp("sync_usage_reset_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("users_email_idx").on(table.email),
]);
