import type { Saga, SagaSource, VideoData } from "@/types/youtube";

/** Where a series came from: a saga (playlist / AI / manual) or detected from titles. */
export type SeriesKind = SagaSource | "title";

/** A run of videos that continue one another, oldest first. */
export interface Series {
  /** Saga id, or `title:<normalized stem>` for title-detected series. */
  id: string;
  name: string;
  kind: SeriesKind;
  /** Chronological (oldest first); only videos present in the catalog; length >= 2. */
  videoIds: string[];
  firstPublishedAt: string;
  lastPublishedAt: string;
}

/** Where one video sits inside its series. */
export interface SeriesPosition {
  series: Series;
  /** 0-based position in `series.videoIds`. */
  index: number;
  total: number;
  prevVideoId: string | null;
  nextVideoId: string | null;
  /** Whole days since the previous episode was published; null for the first. */
  gapDays: number | null;
}

export interface SeriesIndex {
  /** Oldest series first (by firstPublishedAt). */
  series: Series[];
  /** A video belongs to at most one series. Videos in no series are absent. */
  byVideo: Map<string, SeriesPosition>;
}

const DAY_MS = 86_400_000;
const SAGA_PRIORITY: Record<SagaSource, number> = { manual: 0, "ai-detected": 1, playlist: 2 };
const ROMANS = "i ii iii iv v vi vii viii ix x xi xii xiii xiv xv xvi xvii xviii xix xx".split(" ");
// All patterns run on whitespace-collapsed, accent-folded text and are linear (bounded quantifiers).
const KEYWORD_RE =
  /(?<![\p{L}\p{N}])(?:episodio|episode|capitulo|chapter|volume|parte|part|day|dia|vol|pt|ep|cap)\.? ?#?(\d{1,4}|[ivx]{1,4})(?![\p{L}\p{N}])/giu;
const HASH_RE = /#(\d{1,4})(?![\p{L}\p{N}])/gu;
const FRACTION_RE = /(?<![\p{L}\p{N}])[([]?(\d{1,3}) ?\/ ?\d{1,3}[)\]]?$/u;
const BARE_RE = /(?: [-\u2013\u2014] ?| ?[:|] ?)(\d{1,3})$|(?: |^)[([](\d{1,3})[)\]]$/u;

interface Parsed {
  /** Title with the episode marker removed, original case, tidy edges. */
  display: string;
  num: number | null;
}

const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
/** Unparseable dates sort last; never NaN. */
const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};
/** Strips accents without changing string length, so match indices stay valid. */
const fold = (s: string) =>
  s.replace(/[^ -~]/gu, (ch) => {
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    return base.length === 1 ? base : ch;
  });
const tidy = (s: string) =>
  s
    .replace(/[([]\s*[)\]]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-\u2013\u2014:|,]+|[\s\-\u2013\u2014:|,]+$/g, "");
const normalizeStem = (s: string) =>
  fold(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function lastMatch(re: RegExp, text: string) {
  let found: { index: number; length: number; num: number } | null = null;
  for (const m of text.matchAll(re)) {
    const raw = m[1].toLowerCase();
    const num = /^\d+$/.test(raw) ? Number(raw) : ROMANS.indexOf(raw) + 1;
    if (num > 0) found = { index: m.index, length: m[0].length, num };
  }
  return found;
}

/** Strips ONE episode marker (keyword, #n, trailing n/m, trailing bare number). */
function parseTitle(title: string): Parsed {
  const text = title.normalize("NFC").replace(/\s+/g, " ").trim();
  const folded = fold(text);
  let hit = lastMatch(KEYWORD_RE, folded) ?? lastMatch(HASH_RE, folded);
  if (!hit) {
    const m = FRACTION_RE.exec(folded) ?? BARE_RE.exec(folded);
    const digits = m && (m[1] ?? m[2]);
    if (m && digits) hit = { index: m.index, length: m[0].length, num: Number(digits) };
  }
  if (!hit) return { display: tidy(text), num: null };
  const display = tidy(`${text.slice(0, hit.index)} ${text.slice(hit.index + hit.length)}`);
  return { display, num: hit.num };
}

function toSeries(
  id: string,
  name: string,
  kind: SeriesKind,
  ids: string[],
  at: Map<string, number>,
  videoTime: Map<string, string>
): Series {
  ids.sort((a, b) => cmp(at.get(a)!, at.get(b)!));
  return {
    id,
    name,
    kind,
    videoIds: ids,
    firstPublishedAt: videoTime.get(ids[0])!,
    lastPublishedAt: videoTime.get(ids[ids.length - 1])!,
  };
}

/**
 * Groups `videos` into series. Sagas win over title detection; a video joins
 * at most one series. See the unit tests for the exact rules.
 */
export function buildSeriesIndex(
  videos: readonly VideoData[],
  sagas: readonly Saga[]
): SeriesIndex {
  const byId = new Map(videos.map((v) => [v.videoId, v]));
  const sorted = [...byId.values()].sort(
    (a, b) =>
      cmp(time(a.publishedAt), time(b.publishedAt)) || cmp(a.videoId < b.videoId ? -1 : 1, 0)
  );
  const at = new Map(sorted.map((v, i) => [v.videoId, i]));
  const published = new Map(sorted.map((v) => [v.videoId, v.publishedAt]));
  const claimed = new Set<string>();
  const series: Series[] = [];
  const add = (s: Series) => {
    series.push(s);
    s.videoIds.forEach((id) => claimed.add(id));
  };

  const orderedSagas = [...sagas].sort(
    (a, b) =>
      SAGA_PRIORITY[a.source] - SAGA_PRIORITY[b.source] ||
      cmp(time(a.dateRange.first), time(b.dateRange.first)) ||
      cmp(a.id < b.id ? -1 : 1, 0)
  );
  for (const saga of orderedSagas) {
    const ids = [...new Set(saga.videoIds)].filter((id) => byId.has(id) && !claimed.has(id));
    if (ids.length >= 2) add(toSeries(saga.id, saga.name, saga.source, ids, at, published));
  }

  const groups = new Map<string, { id: string; parsed: Parsed }[]>();
  for (const v of sorted) {
    if (claimed.has(v.videoId)) continue;
    const parsed = parseTitle(v.title);
    const stem = normalizeStem(parsed.display);
    if (stem.length < 4) continue;
    const members = groups.get(stem) ?? [];
    members.push({ id: v.videoId, parsed });
    groups.set(stem, members);
  }
  for (const [stem, members] of groups) {
    const marked = members.filter((m) => m.parsed.num !== null);
    if (new Set(marked.map((m) => m.parsed.num)).size < 2) continue;
    const unmarked = members.find((m) => m.parsed.num === null); // earliest; acts as episode 1
    const chosen = unmarked ? [...marked, unmarked] : marked;
    const ids = chosen.map((m) => m.id);
    const first = chosen.reduce((a, b) => (at.get(b.id)! < at.get(a.id)! ? b : a));
    add(toSeries(`title:${stem}`, first.parsed.display, "title", ids, at, published));
  }

  series.sort(
    (a, b) =>
      cmp(time(a.firstPublishedAt), time(b.firstPublishedAt)) || cmp(a.id < b.id ? -1 : 1, 0)
  );
  const byVideo = new Map<string, SeriesPosition>();
  for (const s of series) {
    s.videoIds.forEach((id, i) => {
      const gap = i === 0 ? NaN : (time(published.get(id)!) - time(published.get(s.videoIds[i - 1])!)) / DAY_MS;
      byVideo.set(id, {
        series: s,
        index: i,
        total: s.videoIds.length,
        prevVideoId: s.videoIds[i - 1] ?? null,
        nextVideoId: s.videoIds[i + 1] ?? null,
        gapDays: i === 0 ? null : Number.isFinite(gap) ? Math.max(0, Math.round(gap)) : 0,
      });
    });
  }
  return { series, byVideo };
}
