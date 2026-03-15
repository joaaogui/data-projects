import { db } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("admin-stats");

export const GET = withErrorHandling("admin-stats", async (_req, _ctx) => {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  log.info("Fetching stats");

  const globalStart = Date.now();
  const globalResult = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM channels) AS channels,
      (SELECT count(*) FROM videos) AS videos,
      (SELECT count(*) FROM transcripts) AS transcripts,
      (SELECT count(*) FROM sagas) AS sagas,
      (SELECT count(*) FROM sync_jobs) AS sync_jobs,
      (SELECT count(*) FROM suggestion_cache) AS suggestions,
      (SELECT count(*) FROM transcripts WHERE excerpt IS NULL AND full_text IS NULL) AS transcripts_no_content,
      (SELECT count(*) FROM videos v LEFT JOIN transcripts t ON t.video_id = v.id WHERE t.video_id IS NULL) AS videos_without_transcripts
  `);
  const globalRow = globalResult.rows[0];
  log.info({ ms: Date.now() - globalStart }, "Global query complete");

  const channelStart = Date.now();
  const channelRows = await db.execute(sql`
    SELECT
      c.id,
      c.title,
      c.thumbnail_url,
      c.fetched_at,
      count(DISTINCT v.id) AS video_count,
      count(DISTINCT t.video_id) AS transcript_count,
      count(DISTINCT CASE WHEN t.excerpt IS NOT NULL THEN t.video_id END) AS has_excerpt,
      count(DISTINCT CASE WHEN t.full_text IS NOT NULL THEN t.video_id END) AS has_full_text,
      count(DISTINCT CASE WHEN t.video_id IS NOT NULL AND t.excerpt IS NULL AND t.full_text IS NULL THEN t.video_id END) AS null_transcripts,
      count(DISTINCT CASE WHEN s.source = 'playlist' THEN s.id END) AS playlist_sagas,
      count(DISTINCT CASE WHEN s.source = 'ai-detected' THEN s.id END) AS ai_sagas
    FROM channels c
    LEFT JOIN videos v ON v.channel_id = c.id
    LEFT JOIN transcripts t ON t.video_id = v.id
    LEFT JOIN sagas s ON s.channel_id = c.id
    GROUP BY c.id, c.title, c.thumbnail_url, c.fetched_at
    ORDER BY c.fetched_at DESC
  `);
  log.info({ ms: Date.now() - channelStart, channelCount: channelRows.rows.length }, "Channel query complete");

  const g = globalRow as Record<string, unknown>;

  return NextResponse.json({
    global: {
      channels: Number(g.channels),
      videos: Number(g.videos),
      transcripts: Number(g.transcripts),
      sagas: Number(g.sagas),
      syncJobs: Number(g.sync_jobs),
      suggestions: Number(g.suggestions),
      transcriptsNoContent: Number(g.transcripts_no_content),
      videosWithoutTranscripts: Number(g.videos_without_transcripts),
    },
    channels: channelRows.rows,
  });
});
