import { getLibrarySummary, type LibrarySummary } from "@/lib/import";
import { sql } from "drizzle-orm";
import {
  getMilestones,
  getRepeatRecords,
  type Milestone,
  type RepeatRecord,
} from "./evolution";
import { localPlayedAt, num, rows, str } from "./query";
import { getStreaks, type Streak } from "./temporal";

export interface TopArtist {
  artist: string;
  plays: number;
  share: number;
}

export interface TopTrack {
  artist: string;
  track: string;
  plays: number;
}

export interface RecentPlay {
  artist: string;
  track: string;
  album: string | null;
  playedAt: string;
}

export interface OverviewStats {
  summary: LibrarySummary;
  activeDays: number;
  playsPerActiveDay: number;
  streaks: { longest: Streak[]; current: Streak | null };
  topArtists: TopArtist[];
  topTracks: TopTrack[];
  recent: RecentPlay[];
  milestones: Milestone[];
  repeatRecords: RepeatRecord[];
}

async function getActivity(): Promise<{ activeDays: number; playsPerActiveDay: number }> {
  const [row] = await rows<{ active_days: unknown; plays: unknown }>(sql`
    SELECT
      COUNT(DISTINCT ${localPlayedAt}::date)::int AS active_days,
      COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
  `);
  const activeDays = num(row?.active_days);
  return {
    activeDays,
    playsPerActiveDay: activeDays ? num(row?.plays) / activeDays : 0,
  };
}

async function getTopArtists(limit = 10): Promise<TopArtist[]> {
  const result = await rows<{ artist_name: unknown; plays: unknown; share: unknown }>(sql`
    SELECT
      s.artist_name,
      COUNT(*)::int AS plays,
      COUNT(*)::float / (SELECT COUNT(*) FROM lastfm.scrobbles) AS share
    FROM lastfm.scrobbles s
    GROUP BY 1
    ORDER BY plays DESC
    LIMIT ${limit}
  `);
  return result.map((row) => ({
    artist: str(row.artist_name),
    plays: num(row.plays),
    share: num(row.share),
  }));
}

async function getTopTracks(limit = 10): Promise<TopTrack[]> {
  const result = await rows<{
    artist_name: unknown;
    track_name: unknown;
    plays: unknown;
  }>(sql`
    SELECT s.artist_name, s.track_name, COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1, 2
    ORDER BY plays DESC
    LIMIT ${limit}
  `);
  return result.map((row) => ({
    artist: str(row.artist_name),
    track: str(row.track_name),
    plays: num(row.plays),
  }));
}

async function getRecent(limit = 12): Promise<RecentPlay[]> {
  const result = await rows<{
    artist_name: unknown;
    track_name: unknown;
    album_name: unknown;
    played_at: unknown;
  }>(sql`
    SELECT s.artist_name, s.track_name, s.album_name, s.played_at
    FROM lastfm.scrobbles s
    ORDER BY s.played_at DESC
    LIMIT ${limit}
  `);
  return result.map((row) => ({
    artist: str(row.artist_name),
    track: str(row.track_name),
    album: row.album_name === null ? null : str(row.album_name),
    playedAt: str(row.played_at),
  }));
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [
    summary,
    activity,
    streaks,
    topArtists,
    topTracks,
    recent,
    milestones,
    repeatRecords,
  ] = await Promise.all([
    getLibrarySummary(),
    getActivity(),
    getStreaks(),
    getTopArtists(),
    getTopTracks(),
    getRecent(),
    getMilestones(),
    getRepeatRecords(),
  ]);

  return {
    summary,
    activeDays: activity.activeDays,
    playsPerActiveDay: activity.playsPerActiveDay,
    streaks,
    topArtists,
    topTracks,
    recent,
    milestones,
    repeatRecords,
  };
}
