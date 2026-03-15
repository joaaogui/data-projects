import {
  TRANSCRIPT_BASE_DELAY_MS,
  TRANSCRIPT_COOLDOWN_JITTER_MS,
  TRANSCRIPT_LANGUAGE_PRIORITY,
  TRANSCRIPT_MAX_RETRIES,
  YT_DLP_TIMEOUT_MS,
} from "@/lib/constants";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { YouTubeTranscriptApi } from "youtube-transcript-api-js";
import { createTaggedLogger } from "./logger";
import { runWorkerPool, sleep, WorkerPoolError } from "./utils";

const log = createTaggedLogger("transcript");

const execFileAsync = promisify(execFile);
const api = new YouTubeTranscriptApi();

const VALID_VIDEO_ID = /^[\w-]{11}$/;

export interface TranscriptResult {
  fullText: string;
  excerpt: string;
  language: string;
}

export type TranscriptFetchOutcome =
  | { status: "ok"; data: TranscriptResult }
  | { status: "no_captions" }
  | { status: "error"; reason: string };

const LANGUAGE_PRIORITY_STR = TRANSCRIPT_LANGUAGE_PRIORITY.join(",");

let globalCooldownUntil = 0;

function isBotDetection(msg: string): boolean {
  return msg.includes("Sign in") || msg.includes("bot") || msg.includes("confirm");
}

function isAgeRestricted(msg: string): boolean {
  return msg.includes("age-restricted") || msg.includes("age restricted");
}

async function waitForCooldown() {
  const now = Date.now();
  if (globalCooldownUntil > now) {
    const remaining = globalCooldownUntil - now;
    const jitter = Math.floor(Math.random() * TRANSCRIPT_COOLDOWN_JITTER_MS);
    await sleep(remaining + jitter);
  }
}

function triggerCooldown(durationMs: number) {
  const until = Date.now() + durationMs;
  if (until > globalCooldownUntil) {
    globalCooldownUntil = until;
  }
}

const VTT_SKIP = /^(WEBVTT|Kind:|Language:|NOTE|\d{2}:\d{2}|align:)/;
const HTML_TAG = /<[^>]+>/g;

function parseVttToText(vtt: string): string {
  const textLines: string[] = [];
  let prev = "";

  for (const raw of vtt.split("\n")) {
    const line = raw.trim();
    if (!line || VTT_SKIP.test(line)) continue;

    const clean = line.replaceAll(HTML_TAG, "").trim();
    if (!clean || clean === prev) continue;
    prev = clean;
    textLines.push(clean);
  }

  return textLines.join(" ").trim();
}

const YT_DLP_MAX_RETRIES = 3;
const YT_DLP_RETRY_DELAY_MS = 5_000;

const ytDlpAvailable: Promise<boolean> = execFileAsync("which", ["yt-dlp"])
  .then(() => true)
  .catch(() => {
    log.warn("yt-dlp binary not found — subtitle fallback disabled");
    return false;
  });

function assertValidVideoId(videoId: string): void {
  if (!VALID_VIDEO_ID.test(videoId)) {
    throw new Error(`Invalid video ID format: ${videoId.slice(0, 20)}`);
  }
}

async function runYtDlp(videoId: string, tmpDir: string): Promise<void> {
  assertValidVideoId(videoId);
  await execFileAsync("yt-dlp", [
    "--write-auto-sub",
    "--write-sub",
    "--sub-lang", LANGUAGE_PRIORITY_STR,
    "--sub-format", "vtt",
    "--skip-download",
    "--no-warnings",
    "-o", path.join(tmpDir, "sub"),
    `https://www.youtube.com/watch?v=${videoId}`,
  ], { timeout: YT_DLP_TIMEOUT_MS });
}

function parseVttFile(chosen: string, tmpDir: string, excerptMaxChars: number): Promise<TranscriptResult | null> {
  const langRe = /\.([a-z]{2}(?:-[a-zA-Z]+)?)\.vtt$/;
  const language = langRe.exec(chosen)?.[1] ?? "unknown";

  return readFile(path.join(tmpDir, chosen), "utf-8").then(content => {
    const fullText = parseVttToText(content);
    if (!fullText) return null;
    return { fullText, excerpt: fullText.slice(0, excerptMaxChars).trim(), language };
  });
}

async function fetchWithYtDlp(
  videoId: string,
  excerptMaxChars: number,
): Promise<TranscriptResult | null> {
  if (!(await ytDlpAvailable)) return null;

  const tmpDir = await mkdtemp(path.join(tmpdir(), "yt-sub-"));

  try {
    for (let attempt = 0; attempt < YT_DLP_MAX_RETRIES; attempt++) {
      try {
        await runYtDlp(videoId, tmpDir);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isRetryable = msg.includes("429") || msg.includes("Too Many");
        if (!isRetryable || attempt >= YT_DLP_MAX_RETRIES - 1) throw err;
        log.warn({ videoId, attempt: attempt + 1, maxRetries: YT_DLP_MAX_RETRIES }, "yt-dlp 429 rate limited, retrying");
        await sleep(YT_DLP_RETRY_DELAY_MS * (attempt + 1));
      }
    }

    const files = await readdir(tmpDir);
    const vttFiles = files.filter(f => f.endsWith(".vtt"));
    if (vttFiles.length === 0) return null;

    const preferred = TRANSCRIPT_LANGUAGE_PRIORITY
      .map(lang => vttFiles.find(f => f.includes(`.${lang}.`)))
      .find(Boolean);

    return parseVttFile(preferred ?? vttFiles[0], tmpDir, excerptMaxChars);
  } catch (err) {
    log.warn({ err, videoId }, "yt-dlp fallback failed");
    return null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch((err) => {
      log.warn({ err, tmpDir }, "Failed to clean up temp directory");
    });
  }
}

export async function fetchFullTranscript(
  videoId: string,
  excerptMaxChars = 300
): Promise<TranscriptResult | null> {
  const outcome = await fetchFullTranscriptWithStatus(videoId, excerptMaxChars);
  return outcome.status === "ok" ? outcome.data : null;
}

async function handleAgeRestricted(
  videoId: string,
  excerptMaxChars: number,
): Promise<TranscriptFetchOutcome> {
  log.info({ videoId }, "Age-restricted, falling back to yt-dlp");
  const result = await fetchWithYtDlp(videoId, excerptMaxChars);
  if (result) return { status: "ok", data: result };
  return { status: "error", reason: "age-restricted (yt-dlp fallback failed)" };
}

function classifyError(msg: string): "bot" | "age_restricted" | "no_captions" | "unknown" {
  if (isBotDetection(msg)) return "bot";
  if (isAgeRestricted(msg)) return "age_restricted";
  if (msg.includes("disabled") || msg.includes("not available") || msg.includes("No transcript") || msg.includes("Subtitles")) return "no_captions";
  return "unknown";
}

function toOutcome(
  msg: string,
  kind: ReturnType<typeof classifyError>,
  videoId: string,
  excerptMaxChars: number,
): TranscriptFetchOutcome | Promise<TranscriptFetchOutcome> {
  if (kind === "age_restricted") return handleAgeRestricted(videoId, excerptMaxChars);
  if (kind === "no_captions") return { status: "no_captions" };
  return { status: "error", reason: msg };
}

export async function fetchFullTranscriptWithStatus(
  videoId: string,
  excerptMaxChars = 300
): Promise<TranscriptFetchOutcome> {
  for (let attempt = 0; attempt <= TRANSCRIPT_MAX_RETRIES; attempt++) {
    await waitForCooldown();

    try {
      const transcript = await api.fetch(videoId, TRANSCRIPT_LANGUAGE_PRIORITY);
      const fullText = transcript.snippets.map((s) => s.text).join(" ").trim();
      if (!fullText) return { status: "no_captions" };

      const excerpt = fullText.slice(0, excerptMaxChars).trim();
      return { status: "ok", data: { fullText, excerpt, language: transcript.languageCode ?? "unknown" } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const kind = classifyError(msg);

      if (kind === "bot" && attempt < TRANSCRIPT_MAX_RETRIES) {
        triggerCooldown(TRANSCRIPT_BASE_DELAY_MS * 2 ** attempt);
        log.warn({ videoId, attempt: attempt + 1, cooldownMs: TRANSCRIPT_BASE_DELAY_MS * 2 ** attempt }, "Bot detection, applying cooldown");
        continue;
      }

      return toOutcome(msg, kind, videoId, excerptMaxChars);
    }
  }

  return { status: "error", reason: "max retries exceeded" };
}

export async function fetchTranscriptExcerpt(
  videoId: string,
  maxChars = 1000
): Promise<string | null> {
  const result = await fetchFullTranscript(videoId, maxChars);
  return result?.excerpt ?? null;
}

const TRANSCRIPT_CONCURRENCY = 8;
const TRANSCRIPT_GAP_MS = 100;

export async function fetchTranscriptBatch(
  videoIds: string[],
  maxChars = 1000,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  try {
    await runWorkerPool(videoIds, async (id) => {
      const excerpt = await fetchTranscriptExcerpt(id, maxChars);
      if (excerpt) results.set(id, excerpt);
    }, { concurrency: TRANSCRIPT_CONCURRENCY, gapMs: TRANSCRIPT_GAP_MS, staggerMs: 500 });
  } catch (err) {
    if (err instanceof WorkerPoolError) {
      log.warn({ failedCount: err.errors.length }, "Some transcripts failed in batch");
    } else {
      throw err;
    }
  }

  return results;
}
