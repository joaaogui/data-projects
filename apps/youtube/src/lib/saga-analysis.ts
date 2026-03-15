import type { fetchChannelPlaylists } from "@/services/channel-client";
import type { Saga, VideoData } from "@/types/youtube";

export const BATCH_SIZE = 30;
export const OVERLAP = 3;

export interface UncategorizedRun { start: number; end: number }

export function splitLargeRun(run: UncategorizedRun, maxSize: number): UncategorizedRun[] {
  const size = run.end - run.start + 1;
  if (size <= maxSize) return [run];
  const subRuns: UncategorizedRun[] = [];
  let pos = run.start;
  while (pos <= run.end) {
    const end = Math.min(pos + maxSize - 1, run.end);
    subRuns.push({ start: pos, end });
    pos = end + 1;
  }
  return subRuns;
}

export function findUncategorizedRuns(sorted: VideoData[], sagaVideoIds: Set<string>): UncategorizedRun[] {
  const runs: UncategorizedRun[] = [];
  let runStart = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sagaVideoIds.has(sorted[i].videoId)) {
      if (runStart >= 0) runs.push({ start: runStart, end: i - 1 });
      runStart = -1;
    } else if (runStart === -1) {
      runStart = i;
    }
  }
  if (runStart >= 0) runs.push({ start: runStart, end: sorted.length - 1 });
  return runs;
}

export function buildRunContext(
  run: UncategorizedRun,
  sorted: VideoData[],
  allSagas: Saga[]
): { overlapContext: string; batchVideos: VideoData[] } {
  const runSize = run.end - run.start + 1;
  const contextSize = runSize <= 2 ? 4 : 2;
  const contextStart = Math.max(0, run.start - contextSize);
  const contextEnd = Math.min(sorted.length - 1, run.end + contextSize);
  const batchVideos = sorted.slice(contextStart, contextEnd + 1);

  const contextBefore = sorted.slice(contextStart, run.start);
  const contextAfter = sorted.slice(run.end + 1, contextEnd + 1);

  let overlapContext = "";
  if (contextBefore.length > 0) {
    const beforeSagas = allSagas.filter((s) =>
      contextBefore.some((v) => s.videoIds.includes(v.videoId))
    );
    if (beforeSagas.length > 0) {
      overlapContext += `Previous saga: "${beforeSagas.at(-1)?.name}". `;
    }
  }
  if (contextAfter.length > 0) {
    const afterSagas = allSagas.filter((s) =>
      contextAfter.some((v) => s.videoIds.includes(v.videoId))
    );
    if (afterSagas.length > 0) {
      overlapContext += `Next saga: "${afterSagas[0]?.name}".`;
    }
  }
  return { overlapContext, batchVideos };
}

export function buildPlaylistSagas(
  playlists: Awaited<ReturnType<typeof fetchChannelPlaylists>>,
  videos: VideoData[]
): Saga[] {
  const videoMap = new Map(videos.map((v) => [v.videoId, v]));
  const sagas: Saga[] = [];

  for (const pl of playlists) {
    const matchedIds = pl.videoIds.filter((id) => videoMap.has(id));
    if (matchedIds.length === 0) continue;

    const dates = matchedIds
      .map((id) => videoMap.get(id)!.publishedAt)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    sagas.push({
      id: `playlist-${pl.playlistId}`,
      name: pl.title,
      source: "playlist",
      playlistId: pl.playlistId,
      videoIds: matchedIds,
      videoCount: matchedIds.length,
      dateRange: {
        first: dates[0] ?? "",
        last: dates.at(-1) ?? "",
      },
    });
  }

  return sagas;
}

export function createBatches(videos: VideoData[]): VideoData[][] {
  const sorted = [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const batches: VideoData[][] = [];
  let start = 0;

  while (start < sorted.length) {
    const end = Math.min(start + BATCH_SIZE, sorted.length);
    batches.push(sorted.slice(start, end));
    start = end - OVERLAP;
    if (start >= sorted.length) break;
    if (sorted.length - start < OVERLAP + 2) {
      batches[batches.length - 1] = sorted.slice(batches.length > 1 ? end - BATCH_SIZE - OVERLAP : 0, sorted.length);
      break;
    }
  }

  return batches;
}

const MAX_MERGE_GAP_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "a", "o", "e", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas",
  "um", "uma", "em", "com", "por", "para", "que", "se", "ao", "pelo", "pela",
  "luiz", "som", "manetikin", "dona",
]);

function stemPt(word: string): string {
  if (word.length <= 3) return word;
  let w = word;
  w = w.replace(/ões$/, "ao").replace(/ães$/, "ae");
  if (w.endsWith("s") && w.length > 4) w = w.slice(0, -1);
  return w;
}

function significantWords(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stemPt);
}

function namesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const shared = wordsA.filter((w) => wordsB.includes(w));
  const minLen = Math.min(wordsA.length, wordsB.length);
  return shared.length >= 1 && shared.length >= minLen * 0.5;
}

function dateBounds(videoIds: string[], dateMap: Map<string, number>): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const id of videoIds) {
    const ts = dateMap.get(id);
    if (ts !== undefined) {
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
  }
  return min <= max ? { min, max } : null;
}

function findAdjacentSaga(
  result: Saga[],
  segName: string,
  segVideoIds: string[],
  dateMap: Map<string, number>
): Saga | undefined {
  const segBounds = dateBounds(segVideoIds, dateMap);
  if (!segBounds) return undefined;

  for (const s of result) {
    if (s.source !== "ai-detected") continue;
    if (!namesMatch(stripDateSuffix(s.name), segName)) continue;

    const sagaBounds = dateBounds(s.videoIds, dateMap);
    if (!sagaBounds) continue;

    const gap = Math.min(
      Math.abs(segBounds.min - sagaBounds.max),
      Math.abs(sagaBounds.min - segBounds.max)
    );

    if (gap <= MAX_MERGE_GAP_MS) return s;
  }

  return undefined;
}

const DATE_SUFFIX_RE = /\s*\([A-Z][a-z]{2}\s+\d{4}\)/g;

function stripDateSuffix(name: string): string {
  return name.replaceAll(DATE_SUFFIX_RE, "").trim();
}

function makeDateSuffix(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return ` (${months[d.getMonth()]} ${d.getFullYear()})`;
}

function computeDateRange(videoIds: string[], videoMap: Map<string, VideoData>): { first: string; last: string } {
  const dates = videoIds
    .map((id) => videoMap.get(id)?.publishedAt)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.localeCompare(b));
  return { first: dates[0] ?? "", last: dates.at(-1) ?? "" };
}

type NewSegment = { name: string; videoIds: string[]; reasoning?: string; videoEvidence?: Record<string, string> };

function mergeIntoAdjacent(
  adjacent: Saga,
  validIds: string[],
  seg: NewSegment,
  assignedVideoIds: Set<string>,
  videoMap: Map<string, VideoData>
): void {
  for (const id of validIds) {
    adjacent.videoIds.push(id);
    assignedVideoIds.add(id);
  }
  adjacent.videoCount = adjacent.videoIds.length;
  adjacent.dateRange = computeDateRange(adjacent.videoIds, videoMap);
  if (seg.reasoning) {
    adjacent.reasoning = adjacent.reasoning
      ? `${adjacent.reasoning} ${seg.reasoning}`
      : seg.reasoning;
  }
  if (seg.videoEvidence) {
    adjacent.videoEvidence = { ...adjacent.videoEvidence, ...seg.videoEvidence };
  }
}

function createNewSaga(
  seg: NewSegment,
  validIds: string[],
  baseName: string,
  result: Saga[],
  videoMap: Map<string, VideoData>,
  batchIndex: number
): Saga {
  const dateRange = computeDateRange(validIds, videoMap);
  const hasDuplicate = result.some((s) => s.source === "ai-detected" && namesMatch(s.name, baseName));
  const name = hasDuplicate ? baseName + makeDateSuffix(dateRange.first) : baseName;

  return {
    id: `ai-${batchIndex}-${name.toLowerCase().replaceAll(/\s+/g, "-")}`,
    name,
    source: "ai-detected",
    videoIds: validIds,
    videoCount: validIds.length,
    dateRange,
    reasoning: seg.reasoning,
    videoEvidence: seg.videoEvidence,
  };
}

function processNewSegment(
  seg: NewSegment,
  result: Saga[],
  assignedVideoIds: Set<string>,
  videoMap: Map<string, VideoData>,
  dateMap: Map<string, number>,
  batchIndex: number
): void {
  const validIds = seg.videoIds.filter(
    (id) => videoMap.has(id) && !assignedVideoIds.has(id)
  );
  if (validIds.length === 0) return;

  const baseName = stripDateSuffix(seg.name);
  const adjacent = findAdjacentSaga(result, baseName, validIds, dateMap);

  if (validIds.length < 2 && !adjacent) return;

  if (adjacent) {
    mergeIntoAdjacent(adjacent, validIds, seg, assignedVideoIds, videoMap);
  } else {
    for (const id of validIds) assignedVideoIds.add(id);
    result.push(createNewSaga(seg, validIds, baseName, result, videoMap, batchIndex));
  }
}

export function mergeSagaSegments(
  existingSagas: Saga[],
  newSegments: Array<{ name: string; videoIds: string[]; reasoning?: string; videoEvidence?: Record<string, string> }>,
  videos: VideoData[],
  batchIndex: number,
  excludeVideoIds?: Set<string>
): Saga[] {
  const videoMap = new Map(videos.map((v) => [v.videoId, v]));
  const dateMap = new Map(videos.map((v) => [v.videoId, new Date(v.publishedAt).getTime()]));

  const result = [...existingSagas];
  const assignedVideoIds = new Set(result.flatMap((s) => s.videoIds));
  if (excludeVideoIds) {
    for (const id of excludeVideoIds) assignedVideoIds.add(id);
  }

  for (const seg of newSegments) {
    processNewSegment(seg, result, assignedVideoIds, videoMap, dateMap, batchIndex);
  }

  return result.sort((a, b) => a.dateRange.first.localeCompare(b.dateRange.first));
}
