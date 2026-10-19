import { validateVideoId } from "./validation";

/**
 * Pasting a YouTube URL with only the host swapped lands on this app.
 * `/watch?v=ID` is handled by the `/watch` route; the other YouTube URL shapes
 * (`youtu.be/ID`, `/shorts/ID`, `/live/ID`, `/embed/ID`) are rewritten to it in
 * `next.config.mjs` using these patterns.
 */
export const VIDEO_ID_PATTERN = "[A-Za-z0-9_-]{11}";

/** The channel page opens the Timeline tab on `v` and highlights that video. */
export function timelinePath(channelId: string, videoId: string): string {
  const params = new URLSearchParams({ tab: "timeline", v: videoId });
  return `/channel/${encodeURIComponent(channelId)}?${params}`;
}

/** Returns the video ID if `value` is a well-formed one, otherwise null. */
export function parseVideoId(value: string | null | undefined): string | null {
  const result = validateVideoId(value);
  return result.valid ? (result.sanitized ?? null) : null;
}
