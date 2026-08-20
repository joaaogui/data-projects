import { env } from "./env";
import { AppError } from "./errors";

const API_URL = "https://ws.audioscrobbler.com/2.0/";

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 500;
/** Last.fm error 29. Backing off harder than for a 5xx buys the window back. */
const RATE_LIMIT_BASE_MS = 5_000;
const LASTFM_ERROR_RATE_LIMIT = 29;
const LASTFM_ERROR_TEMPORARY = 16;
const LASTFM_ERROR_SERVICE_OFFLINE = 11;

const sleep = (ms: number) => new Promise((r) => globalThis.setTimeout(r, ms));

/** The key is a query param, so it lands in every URL we might log or throw. */
function redactKey(url: string): string {
  return url.replace(/api_key=[^&]+/, "api_key=REDACTED");
}

function buildUrl(method: string, params: Record<string, string | number>): string {
  const search = new URLSearchParams({
    method,
    api_key: env.LASTFM_API_KEY,
    format: "json",
  });
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `${API_URL}?${search.toString()}`;
}

interface LastfmErrorBody {
  error?: number;
  message?: string;
}

function isRetryableLastfmError(code: number): boolean {
  return (
    code === LASTFM_ERROR_RATE_LIMIT ||
    code === LASTFM_ERROR_TEMPORARY ||
    code === LASTFM_ERROR_SERVICE_OFFLINE
  );
}

function backoffFor(code: number | null, attempt: number): number {
  const base = code === LASTFM_ERROR_RATE_LIMIT ? RATE_LIMIT_BASE_MS : RETRY_BASE_MS;
  return base * 2 ** (attempt - 1);
}

/**
 * Last.fm answers with HTTP 200 and an `error` field in the body as often as it
 * uses a status code, so both paths have to be inspected before a response can
 * be trusted.
 */
async function fetchJson<T>(url: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;

    try {
      response = await fetch(url, { headers: { "User-Agent": "listening-habits/0.1" } });
    } catch (err) {
      lastError = new Error(
        `Last.fm request failed: ${(err as Error).message} [${redactKey(url)}]`,
        { cause: err }
      );
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffFor(null, attempt));
      continue;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const errorBody = body as LastfmErrorBody | null;
    const apiErrorCode = typeof errorBody?.error === "number" ? errorBody.error : null;

    if (response.ok && apiErrorCode === null) {
      return body as T;
    }

    const detail = errorBody?.message ?? response.statusText;
    lastError = new Error(
      `Last.fm error ${apiErrorCode ?? response.status}: ${detail} [${redactKey(url)}]`
    );

    const retryable =
      (apiErrorCode !== null && isRetryableLastfmError(apiErrorCode)) ||
      (apiErrorCode === null && response.status >= 500);

    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new AppError(
        "LASTFM_REQUEST_FAILED",
        lastError.message,
        apiErrorCode === LASTFM_ERROR_RATE_LIMIT ? 429 : 502
      );
    }

    await sleep(backoffFor(apiErrorCode, attempt));
  }

  throw new AppError(
    "LASTFM_REQUEST_FAILED",
    lastError?.message ?? `Last.fm request failed [${redactKey(url)}]`,
    502
  );
}

/** Last.fm collapses single-element collections into a bare object. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function nonEmpty(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export interface LastfmUserInfo {
  name: string;
  playcount: number;
  artistCount: number;
  trackCount: number;
  albumCount: number;
  registeredAt: Date;
  url: string;
}

interface RawUserInfo {
  user: {
    name: string;
    playcount: string;
    artist_count: string;
    track_count: string;
    album_count: string;
    url: string;
    registered: { unixtime: string };
  };
}

export async function getUserInfo(user: string): Promise<LastfmUserInfo> {
  const raw = await fetchJson<RawUserInfo>(buildUrl("user.getinfo", { user }));
  return {
    name: raw.user.name,
    playcount: Number(raw.user.playcount),
    artistCount: Number(raw.user.artist_count),
    trackCount: Number(raw.user.track_count),
    albumCount: Number(raw.user.album_count),
    registeredAt: new Date(Number(raw.user.registered.unixtime) * 1000),
    url: raw.user.url,
  };
}

export interface RecentTrack {
  artistName: string;
  artistMbid: string | null;
  trackName: string;
  trackMbid: string | null;
  albumName: string | null;
  albumMbid: string | null;
  playedAt: Date;
}

export interface RecentTracksPage {
  tracks: RecentTrack[];
  page: number;
  totalPages: number;
  total: number;
}

interface RawTrack {
  artist?: { "#text"?: string; mbid?: string };
  album?: { "#text"?: string; mbid?: string };
  name?: string;
  mbid?: string;
  date?: { uts?: string };
  "@attr"?: { nowplaying?: string };
}

interface RawRecentTracks {
  recenttracks?: {
    track?: RawTrack | RawTrack[];
    "@attr"?: { page?: string; totalPages?: string; total?: string };
  };
}

export interface RecentTracksQuery {
  user: string;
  page?: number;
  limit?: number;
  /** Unix seconds, exclusive lower bound as Last.fm applies it. */
  from?: number;
  /** Unix seconds. Pin this across a paged import to keep pages stable. */
  to?: number;
}

export const RECENT_TRACKS_MAX_LIMIT = 200;

export async function getRecentTracks(
  query: RecentTracksQuery
): Promise<RecentTracksPage> {
  const params: Record<string, string | number> = {
    user: query.user,
    limit: query.limit ?? RECENT_TRACKS_MAX_LIMIT,
    page: query.page ?? 1,
  };
  if (query.from !== undefined) params.from = query.from;
  if (query.to !== undefined) params.to = query.to;

  const raw = await fetchJson<RawRecentTracks>(buildUrl("user.getrecenttracks", params));
  const container = raw.recenttracks;
  const attr = container?.["@attr"];

  const tracks = toArray(container?.track)
    // The currently-playing track carries no timestamp and would otherwise be
    // stored with a bogus date, then duplicated once it is really scrobbled.
    .filter((track) => track["@attr"]?.nowplaying !== "true" && track.date?.uts)
    .map<RecentTrack>((track) => ({
      artistName: track.artist?.["#text"]?.trim() ?? "",
      artistMbid: nonEmpty(track.artist?.mbid),
      trackName: track.name?.trim() ?? "",
      trackMbid: nonEmpty(track.mbid),
      albumName: nonEmpty(track.album?.["#text"]),
      albumMbid: nonEmpty(track.album?.mbid),
      playedAt: new Date(Number(track.date!.uts) * 1000),
    }))
    .filter((track) => track.artistName !== "" && track.trackName !== "");

  return {
    tracks,
    page: Number(attr?.page ?? query.page ?? 1),
    totalPages: Number(attr?.totalPages ?? 0),
    total: Number(attr?.total ?? 0),
  };
}

interface RawArtistTopTags {
  toptags?: {
    tag?: { name?: string; count?: number }[] | { name?: string; count?: number };
  };
}

export async function getArtistTopTags(artist: string, limit = 5): Promise<string[]> {
  const raw = await fetchJson<RawArtistTopTags>(
    buildUrl("artist.gettoptags", { artist, autocorrect: 1 })
  );
  return toArray(raw.toptags?.tag)
    .map((tag) => tag.name?.trim())
    .filter((name): name is string => !!name)
    .slice(0, limit);
}
