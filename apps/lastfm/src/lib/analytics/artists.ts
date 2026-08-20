import type { Lifecycle } from "@/lib/lifecycle";
import { sql } from "drizzle-orm";
import { firstRow, localPlayedAt, num, rows, str } from "./query";

export interface ArtistLifecycle {
  artist: string;
  plays: number;
  firstPlayed: string;
  lastPlayed: string;
  months: number;
  peakMonth: string;
  peakPlays: number;
  peakShare: number;
  lifecycle: Lifecycle;
}

export interface DiscoveryPoint {
  month: string;
  newArtists: number;
  plays: number;
}

export interface Obsession {
  artist: string;
  plays: number;
  peakMonth: string;
  peakPlays: number;
  peakShare: number;
}

export interface Comeback {
  artist: string;
  gapDays: number;
  lastBefore: string;
  returnedAt: string;
  playsSince: number;
  totalPlays: number;
}

export interface ArtistStats {
  discovery: DiscoveryPoint[];
  lifecycle: ArtistLifecycle[];
  lifecycleCounts: Record<Lifecycle, number>;
  obsessions: Obsession[];
  comebacks: Comeback[];
  totalArtists: number;
}

/** Rows returned for the lifecycle table; the counts still cover every artist. */
const LIFECYCLE_LIMIT = 250;

/**
 * Per-artist play totals, active span, and the single month that holds the most
 * plays. Shared by the lifecycle table and the obsession list.
 */
const artistProfileCte = sql`
  WITH monthly AS (
    SELECT
      s.artist_name,
      date_trunc('month', ${localPlayedAt}) AS month,
      COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1, 2
  ),
  peaks AS (
    SELECT DISTINCT ON (artist_name)
      artist_name,
      to_char(month, 'YYYY-MM') AS peak_month,
      plays AS peak_plays
    FROM monthly
    ORDER BY artist_name, plays DESC, month
  ),
  totals AS (
    SELECT
      artist_name,
      SUM(plays)::int AS plays,
      COUNT(*)::int AS months
    FROM monthly
    GROUP BY 1
  ),
  spans AS (
    SELECT
      s.artist_name,
      MIN(s.played_at) AS first_played,
      MAX(s.played_at) AS last_played
    FROM lastfm.scrobbles s
    GROUP BY 1
  ),
  profile AS (
    SELECT
      t.artist_name,
      t.plays,
      t.months,
      sp.first_played,
      sp.last_played,
      p.peak_month,
      p.peak_plays,
      p.peak_plays::float / NULLIF(t.plays, 0) AS peak_share,
      CASE
        WHEN sp.first_played >= now() - INTERVAL '12 months' THEN 'recent'
        WHEN t.plays >= 20 AND p.peak_plays::float / NULLIF(t.plays, 0) >= 0.5 THEN 'phase'
        WHEN t.plays >= 20 AND sp.last_played < now() - INTERVAL '2 years' THEN 'abandoned'
        WHEN t.months >= 12 AND sp.last_played - sp.first_played >= INTERVAL '3 years' THEN 'companion'
        ELSE 'casual'
      END AS lifecycle
    FROM totals t
    JOIN spans sp ON sp.artist_name = t.artist_name
    JOIN peaks p ON p.artist_name = t.artist_name
  )
`;

async function getLifecycle(): Promise<{
  lifecycle: ArtistLifecycle[];
  counts: Record<Lifecycle, number>;
  totalArtists: number;
}> {
  const result = await firstRow<{
    top: unknown;
    counts: unknown;
    total: unknown;
  }>(sql`
    ${artistProfileCte}
    SELECT
      (
        SELECT json_agg(t) FROM (
          SELECT * FROM profile ORDER BY plays DESC LIMIT ${LIFECYCLE_LIMIT}
        ) t
      ) AS top,
      (
        SELECT json_agg(t) FROM (
          SELECT lifecycle, COUNT(*)::int AS n FROM profile GROUP BY 1
        ) t
      ) AS counts,
      (SELECT COUNT(*)::int FROM profile) AS total
  `);

  type RawProfile = {
    artist_name: string;
    plays: number;
    months: number;
    first_played: string;
    last_played: string;
    peak_month: string;
    peak_plays: number;
    peak_share: number;
    lifecycle: Lifecycle;
  };

  const top = (result?.top as RawProfile[] | null) ?? [];
  const rawCounts = (result?.counts as { lifecycle: Lifecycle; n: number }[] | null) ?? [];

  const counts: Record<Lifecycle, number> = {
    recent: 0,
    phase: 0,
    abandoned: 0,
    companion: 0,
    casual: 0,
  };
  for (const row of rawCounts) counts[row.lifecycle] = num(row.n);

  return {
    lifecycle: top.map((row) => ({
      artist: str(row.artist_name),
      plays: num(row.plays),
      firstPlayed: str(row.first_played),
      lastPlayed: str(row.last_played),
      months: num(row.months),
      peakMonth: str(row.peak_month),
      peakPlays: num(row.peak_plays),
      peakShare: num(row.peak_share),
      lifecycle: row.lifecycle,
    })),
    counts,
    totalArtists: num(result?.total),
  };
}

async function getObsessions(): Promise<Obsession[]> {
  const result = await rows<{
    artist_name: unknown;
    plays: unknown;
    peak_month: unknown;
    peak_plays: unknown;
    peak_share: unknown;
  }>(sql`
    ${artistProfileCte}
    SELECT artist_name, plays, peak_month, peak_plays, peak_share
    FROM profile
    WHERE plays >= 50
    ORDER BY peak_share DESC, plays DESC
    LIMIT 20
  `);

  return result.map((row) => ({
    artist: str(row.artist_name),
    plays: num(row.plays),
    peakMonth: str(row.peak_month),
    peakPlays: num(row.peak_plays),
    peakShare: num(row.peak_share),
  }));
}

async function getDiscovery(): Promise<DiscoveryPoint[]> {
  const result = await rows<{ month: unknown; new_artists: unknown; plays: unknown }>(sql`
    WITH firsts AS (
      SELECT s.artist_name, MIN(s.played_at) AS first_played
      FROM lastfm.scrobbles s
      GROUP BY 1
    ),
    discovered AS (
      SELECT
        to_char(date_trunc('month', first_played AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
        COUNT(*)::int AS new_artists
      FROM firsts
      GROUP BY 1
    ),
    played AS (
      SELECT
        to_char(date_trunc('month', ${localPlayedAt}), 'YYYY-MM') AS month,
        COUNT(*)::int AS plays
      FROM lastfm.scrobbles s
      GROUP BY 1
    )
    SELECT
      p.month,
      COALESCE(d.new_artists, 0) AS new_artists,
      p.plays
    FROM played p
    LEFT JOIN discovered d ON d.month = p.month
    ORDER BY p.month
  `);

  return result.map((row) => ({
    month: str(row.month),
    newArtists: num(row.new_artists),
    plays: num(row.plays),
  }));
}

/**
 * The longest silence in each artist's history, and how much listening followed
 * it. Ranking by plays-since surfaces genuine returns rather than an artist who
 * happened to get one nostalgic replay.
 */
async function getComebacks(): Promise<Comeback[]> {
  const result = await rows<{
    artist_name: unknown;
    gap_days: unknown;
    last_before: unknown;
    returned_at: unknown;
    plays_since: unknown;
    total_plays: unknown;
  }>(sql`
    WITH gaps AS (
      SELECT
        s.artist_name,
        s.played_at,
        LAG(s.played_at) OVER w AS previous_at,
        s.played_at - LAG(s.played_at) OVER w AS gap,
        ROW_NUMBER() OVER w AS position,
        COUNT(*) OVER (PARTITION BY s.artist_name) AS total_plays
      FROM lastfm.scrobbles s
      WINDOW w AS (PARTITION BY s.artist_name ORDER BY s.played_at)
    ),
    widest AS (
      SELECT DISTINCT ON (artist_name)
        artist_name,
        previous_at,
        played_at,
        gap,
        (total_plays - position + 1)::int AS plays_since,
        total_plays::int AS total_plays
      FROM gaps
      WHERE gap IS NOT NULL
      ORDER BY artist_name, gap DESC
    )
    SELECT
      artist_name,
      EXTRACT(EPOCH FROM gap) / 86400 AS gap_days,
      previous_at AS last_before,
      played_at AS returned_at,
      plays_since,
      total_plays
    FROM widest
    WHERE gap > INTERVAL '2 years' AND plays_since >= 20
    ORDER BY plays_since DESC
    LIMIT 20
  `);

  return result.map((row) => ({
    artist: str(row.artist_name),
    gapDays: Math.round(num(row.gap_days)),
    lastBefore: str(row.last_before),
    returnedAt: str(row.returned_at),
    playsSince: num(row.plays_since),
    totalPlays: num(row.total_plays),
  }));
}

export async function getArtistStats(): Promise<ArtistStats> {
  const [discovery, lifecycleResult, obsessions, comebacks] = await Promise.all([
    getDiscovery(),
    getLifecycle(),
    getObsessions(),
    getComebacks(),
  ]);

  return {
    discovery,
    lifecycle: lifecycleResult.lifecycle,
    lifecycleCounts: lifecycleResult.counts,
    totalArtists: lifecycleResult.totalArtists,
    obsessions,
    comebacks,
  };
}

export interface ArtistDetail {
  artist: string;
  plays: number;
  firstPlayed: string;
  lastPlayed: string;
  distinctTracks: number;
  months: number;
  rank: number;
  share: number;
  monthly: { month: string; plays: number }[];
  topTracks: { track: string; plays: number }[];
  topAlbums: { album: string; plays: number }[];
}

export async function getArtistDetail(artist: string): Promise<ArtistDetail | null> {
  const summary = await firstRow<{
    plays: unknown;
    first_played: unknown;
    last_played: unknown;
    distinct_tracks: unknown;
    months: unknown;
    rank: unknown;
    share: unknown;
  }>(sql`
    WITH totals AS (
      SELECT artist_name, COUNT(*)::int AS plays
      FROM lastfm.scrobbles
      GROUP BY 1
    ),
    ranked AS (
      SELECT artist_name, plays, RANK() OVER (ORDER BY plays DESC)::int AS rank
      FROM totals
    )
    SELECT
      r.plays,
      r.rank,
      r.plays::float / (SELECT SUM(plays) FROM totals) AS share,
      MIN(s.played_at) AS first_played,
      MAX(s.played_at) AS last_played,
      COUNT(DISTINCT s.track_name)::int AS distinct_tracks,
      COUNT(DISTINCT date_trunc('month', ${localPlayedAt}))::int AS months
    FROM ranked r
    JOIN lastfm.scrobbles s ON s.artist_name = r.artist_name
    WHERE r.artist_name = ${artist}
    GROUP BY r.plays, r.rank
  `);

  if (!summary) return null;

  const [monthly, topTracks, topAlbums] = await Promise.all([
    rows<{ month: unknown; plays: unknown }>(sql`
      SELECT
        to_char(date_trunc('month', ${localPlayedAt}), 'YYYY-MM') AS month,
        COUNT(*)::int AS plays
      FROM lastfm.scrobbles s
      WHERE s.artist_name = ${artist}
      GROUP BY 1
      ORDER BY 1
    `),
    rows<{ track: unknown; plays: unknown }>(sql`
      SELECT s.track_name AS track, COUNT(*)::int AS plays
      FROM lastfm.scrobbles s
      WHERE s.artist_name = ${artist}
      GROUP BY 1
      ORDER BY plays DESC, track
      LIMIT 15
    `),
    rows<{ album: unknown; plays: unknown }>(sql`
      SELECT s.album_name AS album, COUNT(*)::int AS plays
      FROM lastfm.scrobbles s
      WHERE s.artist_name = ${artist} AND s.album_name IS NOT NULL
      GROUP BY 1
      ORDER BY plays DESC, album
      LIMIT 10
    `),
  ]);

  return {
    artist,
    plays: num(summary.plays),
    firstPlayed: str(summary.first_played),
    lastPlayed: str(summary.last_played),
    distinctTracks: num(summary.distinct_tracks),
    months: num(summary.months),
    rank: num(summary.rank),
    share: num(summary.share),
    monthly: monthly.map((row) => ({ month: str(row.month), plays: num(row.plays) })),
    topTracks: topTracks.map((row) => ({ track: str(row.track), plays: num(row.plays) })),
    topAlbums: topAlbums.map((row) => ({ album: str(row.album), plays: num(row.plays) })),
  };
}
