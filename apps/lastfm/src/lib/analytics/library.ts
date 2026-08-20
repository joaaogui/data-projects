import { sql, type SQL } from "drizzle-orm";
import { num, rows, str } from "./query";

export type LibraryKind = "artists" | "tracks";

export interface LibraryArtistRow {
  artist: string;
  plays: number;
  tracks: number;
  firstPlayed: string;
  lastPlayed: string;
}

export interface LibraryTrackRow {
  artist: string;
  track: string;
  album: string | null;
  plays: number;
  firstPlayed: string;
  lastPlayed: string;
}

export interface LibraryResult {
  kind: LibraryKind;
  rows: LibraryArtistRow[] | LibraryTrackRow[];
  /** Rows matching the filter before the limit, so the UI can say "showing N of M". */
  matched: number;
  limit: number;
}

export const LIBRARY_MAX_LIMIT = 2000;
export const LIBRARY_DEFAULT_LIMIT = 500;

/**
 * Case-insensitive substring match. Search runs in Postgres rather than in the
 * table component so a query can reach past the truncated result window.
 */
function matchClause(column: SQL, query: string | null): SQL {
  if (!query) return sql`TRUE`;
  return sql`${column} ILIKE ${`%${query}%`}`;
}

async function getArtists(query: string | null, limit: number): Promise<LibraryResult> {
  const where = matchClause(sql`s.artist_name`, query);

  const [countRow] = await rows<{ matched: unknown }>(sql`
    SELECT COUNT(DISTINCT s.artist_name)::int AS matched
    FROM lastfm.scrobbles s
    WHERE ${where}
  `);

  const result = await rows<{
    artist_name: unknown;
    plays: unknown;
    tracks: unknown;
    first_played: unknown;
    last_played: unknown;
  }>(sql`
    SELECT
      s.artist_name,
      COUNT(*)::int AS plays,
      COUNT(DISTINCT s.track_name)::int AS tracks,
      MIN(s.played_at) AS first_played,
      MAX(s.played_at) AS last_played
    FROM lastfm.scrobbles s
    WHERE ${where}
    GROUP BY 1
    ORDER BY plays DESC, s.artist_name
    LIMIT ${limit}
  `);

  return {
    kind: "artists",
    matched: num(countRow?.matched),
    limit,
    rows: result.map((row) => ({
      artist: str(row.artist_name),
      plays: num(row.plays),
      tracks: num(row.tracks),
      firstPlayed: str(row.first_played),
      lastPlayed: str(row.last_played),
    })),
  };
}

async function getTracks(query: string | null, limit: number): Promise<LibraryResult> {
  const where = query
    ? sql`(s.artist_name ILIKE ${`%${query}%`} OR s.track_name ILIKE ${`%${query}%`})`
    : sql`TRUE`;

  const [countRow] = await rows<{ matched: unknown }>(sql`
    SELECT COUNT(*)::int AS matched
    FROM (
      SELECT 1
      FROM lastfm.scrobbles s
      WHERE ${where}
      GROUP BY s.artist_name, s.track_name
    ) t
  `);

  const result = await rows<{
    artist_name: unknown;
    track_name: unknown;
    album_name: unknown;
    plays: unknown;
    first_played: unknown;
    last_played: unknown;
  }>(sql`
    SELECT
      s.artist_name,
      s.track_name,
      MODE() WITHIN GROUP (ORDER BY s.album_name) AS album_name,
      COUNT(*)::int AS plays,
      MIN(s.played_at) AS first_played,
      MAX(s.played_at) AS last_played
    FROM lastfm.scrobbles s
    WHERE ${where}
    GROUP BY 1, 2
    ORDER BY plays DESC, s.artist_name
    LIMIT ${limit}
  `);

  return {
    kind: "tracks",
    matched: num(countRow?.matched),
    limit,
    rows: result.map((row) => ({
      artist: str(row.artist_name),
      track: str(row.track_name),
      album: row.album_name === null ? null : str(row.album_name),
      plays: num(row.plays),
      firstPlayed: str(row.first_played),
      lastPlayed: str(row.last_played),
    })),
  };
}

export async function getLibrary(
  kind: LibraryKind,
  query: string | null,
  limit: number
): Promise<LibraryResult> {
  const safeLimit = Math.min(Math.max(1, limit), LIBRARY_MAX_LIMIT);
  return kind === "tracks"
    ? getTracks(query, safeLimit)
    : getArtists(query, safeLimit);
}
