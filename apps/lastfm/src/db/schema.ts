import type { ImportLogEntry } from "@/types/lastfm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/*
 * A dedicated Postgres schema rather than `public`. This database is shared
 * with the youtube app, and `drizzle-kit push` drops anything in its managed
 * namespace that is absent from the schema file -- namespacing keeps that blast
 * radius inside this app. `schemaFilter` in drizzle.config.ts enforces the
 * other half of the deal.
 */
export const lastfmSchema = pgSchema("lastfm");

export const scrobbles = lastfmSchema.table(
  "scrobbles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    artistName: text("artist_name").notNull(),
    artistMbid: text("artist_mbid"),
    trackName: text("track_name").notNull(),
    trackMbid: text("track_mbid"),
    albumName: text("album_name"),
    albumMbid: text("album_mbid"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // Last.fm serves overlapping rows at page boundaries and the same track can
    // legitimately be played twice, but never twice in the same second.
    uniqueIndex("scrobbles_unique_play_idx").on(
      table.artistName,
      table.trackName,
      table.playedAt
    ),
    index("scrobbles_played_at_idx").on(table.playedAt),
    index("scrobbles_artist_idx").on(table.artistName),
    index("scrobbles_artist_played_idx").on(table.artistName, table.playedAt),
  ]
);

export const artists = lastfmSchema.table("artists", {
  name: text("name").primaryKey(),
  mbid: text("mbid"),
  tags: jsonb("tags").$type<string[]>(),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
});

export const importJobs = lastfmSchema.table(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    mode: text("mode").notNull(),
    /**
     * Frozen at job start. Pinning the upper bound keeps page numbers stable
     * while the import runs, so scrobbles arriving mid-import cannot shift rows
     * across page boundaries and slip through unseen.
     */
    toTimestamp: integer("to_timestamp").notNull(),
    fromTimestamp: integer("from_timestamp"),
    nextPage: integer("next_page").notNull().default(1),
    totalPages: integer("total_pages"),
    pagesDone: integer("pages_done").notNull().default(0),
    scrobblesImported: integer("scrobbles_imported").notNull().default(0),
    error: text("error"),
    logs: jsonb("logs").$type<ImportLogEntry[]>().notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("import_jobs_started_at_idx").on(table.startedAt)]
);
