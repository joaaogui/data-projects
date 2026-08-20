import { sql } from "drizzle-orm";
import { day, localPlayedAt, num, rows, str } from "./query";

export interface YearRankEntry {
  year: number;
  rank: number;
  artist: string;
  plays: number;
  /** Rank in the previous year, or null if the artist is new to the top 10. */
  previousRank: number | null;
}

export interface YearDiversity {
  year: number;
  plays: number;
  artists: number;
  /** Share of the year's plays taken by its ten biggest artists. */
  top10Share: number;
  /** Shannon entropy over the artist distribution, in nats. */
  entropy: number;
  /** Entropy divided by its theoretical maximum, so years compare fairly. */
  evenness: number;
  /** Top-20 artists also present in the previous year's top 20, out of 20. */
  retainedFromPreviousYear: number | null;
}

export interface OneHitWonder {
  artist: string;
  track: string;
  trackPlays: number;
  totalPlays: number;
  share: number;
}

export interface EvolutionStats {
  ranks: YearRankEntry[];
  diversity: YearDiversity[];
  oneHitWonders: OneHitWonder[];
}

/** Per-year, per-artist play counts with a dense rank. Reused by most queries. */
const yearlyRanksCte = sql`
  WITH yearly AS (
    SELECT
      EXTRACT(YEAR FROM ${localPlayedAt})::int AS year,
      s.artist_name,
      COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1, 2
  ),
  ranked AS (
    SELECT
      year,
      artist_name,
      plays,
      ROW_NUMBER() OVER (PARTITION BY year ORDER BY plays DESC, artist_name)::int AS rank
    FROM yearly
  )
`;

async function getRanks(): Promise<YearRankEntry[]> {
  const result = await rows<{
    year: unknown;
    rank: unknown;
    artist_name: unknown;
    plays: unknown;
    previous_rank: unknown;
  }>(sql`
    ${yearlyRanksCte}
    SELECT
      r.year,
      r.rank,
      r.artist_name,
      r.plays,
      p.rank AS previous_rank
    FROM ranked r
    LEFT JOIN ranked p
      ON p.artist_name = r.artist_name AND p.year = r.year - 1
    WHERE r.rank <= 10
    ORDER BY r.year, r.rank
  `);

  return result.map((row) => ({
    year: num(row.year),
    rank: num(row.rank),
    artist: str(row.artist_name),
    plays: num(row.plays),
    previousRank: row.previous_rank === null ? null : num(row.previous_rank),
  }));
}

/**
 * Concentration measures for each year. Entropy answers "how spread out was
 * the listening", top-10 share answers "how much did the favourites dominate";
 * they can move in opposite directions, which is the interesting part.
 */
async function getDiversity(): Promise<YearDiversity[]> {
  const result = await rows<{
    year: unknown;
    plays: unknown;
    artists: unknown;
    top10_share: unknown;
    entropy: unknown;
    evenness: unknown;
    retained: unknown;
  }>(sql`
    ${yearlyRanksCte}
    , totals AS (
      SELECT year, SUM(plays)::int AS plays, COUNT(*)::int AS artists
      FROM ranked
      GROUP BY 1
    ),
    top10 AS (
      SELECT year, SUM(plays)::int AS plays
      FROM ranked
      WHERE rank <= 10
      GROUP BY 1
    ),
    entropy AS (
      SELECT
        r.year,
        -SUM(
          (r.plays::float / t.plays) * LN(r.plays::float / t.plays)
        ) AS entropy
      FROM ranked r
      JOIN totals t ON t.year = r.year
      GROUP BY r.year
    ),
    loyalty AS (
      SELECT
        r.year,
        COUNT(*) FILTER (WHERE p.artist_name IS NOT NULL)::int AS retained
      FROM ranked r
      LEFT JOIN ranked p
        ON p.artist_name = r.artist_name AND p.year = r.year - 1 AND p.rank <= 20
      WHERE r.rank <= 20
      GROUP BY r.year
    )
    SELECT
      t.year,
      t.plays,
      t.artists,
      tt.plays::float / t.plays AS top10_share,
      e.entropy,
      CASE WHEN t.artists > 1 THEN e.entropy / LN(t.artists) ELSE 0 END AS evenness,
      l.retained
    FROM totals t
    JOIN top10 tt ON tt.year = t.year
    JOIN entropy e ON e.year = t.year
    LEFT JOIN loyalty l ON l.year = t.year
    ORDER BY t.year
  `);

  const years = result.map((row) => num(row.year));
  const earliest = Math.min(...years);

  return result.map((row) => ({
    year: num(row.year),
    plays: num(row.plays),
    artists: num(row.artists),
    top10Share: num(row.top10_share),
    entropy: num(row.entropy),
    evenness: num(row.evenness),
    // The first year has no predecessor, so retention is undefined rather than 0.
    retainedFromPreviousYear: num(row.year) === earliest ? null : num(row.retained),
  }));
}

async function getOneHitWonders(): Promise<OneHitWonder[]> {
  const result = await rows<{
    artist_name: unknown;
    track_name: unknown;
    track_plays: unknown;
    total_plays: unknown;
    share: unknown;
  }>(sql`
    WITH per_track AS (
      SELECT s.artist_name, s.track_name, COUNT(*)::int AS plays
      FROM lastfm.scrobbles s
      GROUP BY 1, 2
    ),
    totals AS (
      SELECT artist_name, SUM(plays)::int AS total_plays
      FROM per_track
      GROUP BY 1
    ),
    best AS (
      SELECT DISTINCT ON (artist_name) artist_name, track_name, plays
      FROM per_track
      ORDER BY artist_name, plays DESC, track_name
    )
    SELECT
      b.artist_name,
      b.track_name,
      b.plays AS track_plays,
      t.total_plays,
      b.plays::float / t.total_plays AS share
    FROM best b
    JOIN totals t ON t.artist_name = b.artist_name
    WHERE t.total_plays >= 40 AND b.plays::float / t.total_plays >= 0.6
    ORDER BY t.total_plays DESC
    LIMIT 20
  `);

  return result.map((row) => ({
    artist: str(row.artist_name),
    track: str(row.track_name),
    trackPlays: num(row.track_plays),
    totalPlays: num(row.total_plays),
    share: num(row.share),
  }));
}

export async function getEvolutionStats(): Promise<EvolutionStats> {
  const [ranks, diversity, oneHitWonders] = await Promise.all([
    getRanks(),
    getDiversity(),
    getOneHitWonders(),
  ]);
  return { ranks, diversity, oneHitWonders };
}

export interface Milestone {
  n: number;
  artist: string;
  track: string;
  playedAt: string;
}

export interface RepeatRecord {
  artist: string;
  track: string;
  day: string;
  plays: number;
}

/** Every 25,000th play, plus the very first. */
const MILESTONE_EVERY = 25_000;

export async function getMilestones(): Promise<Milestone[]> {
  const result = await rows<{
    n: unknown;
    artist_name: unknown;
    track_name: unknown;
    played_at: unknown;
  }>(sql`
    WITH numbered AS (
      SELECT
        s.artist_name,
        s.track_name,
        s.played_at,
        ROW_NUMBER() OVER (ORDER BY s.played_at)::int AS n
      FROM lastfm.scrobbles s
    )
    SELECT n, artist_name, track_name, played_at
    FROM numbered
    WHERE n = 1 OR n % ${MILESTONE_EVERY} = 0
    ORDER BY n
  `);

  return result.map((row) => ({
    n: num(row.n),
    artist: str(row.artist_name),
    track: str(row.track_name),
    playedAt: str(row.played_at),
  }));
}

export async function getRepeatRecords(): Promise<RepeatRecord[]> {
  const result = await rows<{
    artist_name: unknown;
    track_name: unknown;
    d: unknown;
    plays: unknown;
  }>(sql`
    SELECT
      s.artist_name,
      s.track_name,
      ${localPlayedAt}::date AS d,
      COUNT(*)::int AS plays
    FROM lastfm.scrobbles s
    GROUP BY 1, 2, 3
    ORDER BY plays DESC, d DESC
    LIMIT 10
  `);

  return result.map((row) => ({
    artist: str(row.artist_name),
    track: str(row.track_name),
    day: day(row.d),
    plays: num(row.plays),
  }));
}
