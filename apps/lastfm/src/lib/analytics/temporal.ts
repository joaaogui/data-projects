import { env } from "@/lib/env";
import { sql } from "drizzle-orm";
import { day, firstRow, localPlayedAt, num, rows, str } from "./query";

export interface HeatmapCell {
  /** 1 = Monday through 7 = Sunday, matching Postgres ISODOW. */
  weekday: number;
  hour: number;
  plays: number;
}

export interface DayCount {
  day: string;
  plays: number;
}

export interface MonthCount {
  month: string;
  plays: number;
  artists: number;
}

export interface Streak {
  start: string;
  end: string;
  days: number;
}

export interface ListeningSession {
  started: string;
  ended: string;
  tracks: number;
  minutes: number;
  topArtist: string;
}

export interface SessionStats {
  totalSessions: number;
  avgTracks: number;
  avgMinutes: number;
  longest: ListeningSession[];
}

export interface TemporalStats {
  heatmap: HeatmapCell[];
  daily: DayCount[];
  monthly: MonthCount[];
  streaks: {
    longest: Streak[];
    current: Streak | null;
  };
  sessions: SessionStats;
  busiestDay: DayCount | null;
}

/** A pause longer than this ends a listening session. */
const SESSION_GAP_MINUTES = 30;

async function getHeatmap(): Promise<HeatmapCell[]> {
  const result = await rows<{ weekday: unknown; hour: unknown; plays: unknown }>(sql`
    SELECT
      EXTRACT(ISODOW FROM ${localPlayedAt})::int AS weekday,
      EXTRACT(HOUR FROM ${localPlayedAt})::int AS hour,
      COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  return result.map((row) => ({
    weekday: num(row.weekday),
    hour: num(row.hour),
    plays: num(row.plays),
  }));
}

async function getDaily(): Promise<DayCount[]> {
  const result = await rows<{ day: unknown; plays: unknown }>(sql`
    SELECT ${localPlayedAt}::date AS day, COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1
    ORDER BY 1
  `);
  return result.map((row) => ({ day: day(row.day), plays: num(row.plays) }));
}

async function getMonthly(): Promise<MonthCount[]> {
  const result = await rows<{ month: unknown; plays: unknown; artists: unknown }>(sql`
    SELECT
      to_char(date_trunc('month', ${localPlayedAt}), 'YYYY-MM') AS month,
      COUNT(*)::int AS plays,
      COUNT(DISTINCT s.artist_name)::int AS artists
    FROM lastfm.scrobbles s
    GROUP BY 1
    ORDER BY 1
  `);
  return result.map((row) => ({
    month: str(row.month),
    plays: num(row.plays),
    artists: num(row.artists),
  }));
}

/**
 * Consecutive-day runs via gaps-and-islands: subtracting a dense row number
 * from each date makes every unbroken run share one constant value, which can
 * then be grouped.
 */
export async function getStreaks(): Promise<TemporalStats["streaks"]> {
  const result = await firstRow<{ longest: unknown; current: unknown }>(sql`
    WITH days AS (
      SELECT DISTINCT ${localPlayedAt}::date AS d
      FROM lastfm.scrobbles s
    ),
    islands AS (
      SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp
      FROM days
    ),
    runs AS (
      SELECT MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*)::int AS length
      FROM islands
      GROUP BY grp
    )
    SELECT
      (
        SELECT json_agg(t)
        FROM (
          SELECT start_day, end_day, length
          FROM runs ORDER BY length DESC, start_day DESC LIMIT 5
        ) t
      ) AS longest,
      (
        SELECT row_to_json(t)
        FROM (
          SELECT start_day, end_day, length
          FROM runs
          -- "Current" tolerates today having no scrobble yet.
          WHERE end_day >= (now() AT TIME ZONE ${env.LASTFM_TIMEZONE})::date - 1
          ORDER BY end_day DESC LIMIT 1
        ) t
      ) AS current
  `);

  type RawRun = { start_day: string; end_day: string; length: number };
  const toStreak = (run: RawRun): Streak => ({
    start: day(run.start_day),
    end: day(run.end_day),
    days: num(run.length),
  });

  const longest = (result?.longest as RawRun[] | null) ?? [];
  const current = (result?.current as RawRun | null) ?? null;

  return {
    longest: longest.map(toStreak),
    current: current ? toStreak(current) : null,
  };
}

/**
 * Sessions are runs of plays separated by less than SESSION_GAP_MINUTES. The
 * reported duration spans first to last scrobble, so it understates a session
 * by the length of its final track -- Last.fm does not return track durations
 * on the recent-tracks endpoint.
 */
async function getSessions(): Promise<SessionStats> {
  const result = await firstRow<{
    total_sessions: unknown;
    avg_tracks: unknown;
    avg_minutes: unknown;
    longest: unknown;
  }>(sql`
    WITH ordered AS (
      SELECT
        s.played_at,
        s.artist_name,
        CASE
          WHEN LAG(s.played_at) OVER (ORDER BY s.played_at) IS NULL
            OR s.played_at - LAG(s.played_at) OVER (ORDER BY s.played_at)
               > (${SESSION_GAP_MINUTES} || ' minutes')::interval
          THEN 1 ELSE 0
        END AS is_start
      FROM lastfm.scrobbles s
    ),
    marked AS (
      SELECT
        played_at,
        artist_name,
        SUM(is_start) OVER (ORDER BY played_at ROWS UNBOUNDED PRECEDING) AS session_id
      FROM ordered
    ),
    grouped AS (
      SELECT
        session_id,
        MIN(played_at) AS started,
        MAX(played_at) AS ended,
        COUNT(*)::int AS tracks,
        MODE() WITHIN GROUP (ORDER BY artist_name) AS top_artist
      FROM marked
      GROUP BY session_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM grouped) AS total_sessions,
      (SELECT AVG(tracks) FROM grouped) AS avg_tracks,
      (SELECT AVG(EXTRACT(EPOCH FROM (ended - started)) / 60) FROM grouped) AS avg_minutes,
      (
        SELECT json_agg(t)
        FROM (
          SELECT
            started,
            ended,
            tracks,
            top_artist,
            EXTRACT(EPOCH FROM (ended - started)) / 60 AS minutes
          FROM grouped ORDER BY tracks DESC LIMIT 5
        ) t
      ) AS longest
  `);

  type RawSession = {
    started: string;
    ended: string;
    tracks: number;
    top_artist: string;
    minutes: number;
  };
  const longest = (result?.longest as RawSession[] | null) ?? [];

  return {
    totalSessions: num(result?.total_sessions),
    avgTracks: num(result?.avg_tracks),
    avgMinutes: num(result?.avg_minutes),
    longest: longest.map((session) => ({
      started: str(session.started),
      ended: str(session.ended),
      tracks: num(session.tracks),
      minutes: num(session.minutes),
      topArtist: str(session.top_artist),
    })),
  };
}

export async function getTemporalStats(): Promise<TemporalStats> {
  const [heatmap, daily, monthly, streaks, sessions] = await Promise.all([
    getHeatmap(),
    getDaily(),
    getMonthly(),
    getStreaks(),
    getSessions(),
  ]);

  const busiestDay = daily.reduce<DayCount | null>(
    (best, current) => (!best || current.plays > best.plays ? current : best),
    null
  );

  return { heatmap, daily, monthly, streaks, sessions, busiestDay };
}
