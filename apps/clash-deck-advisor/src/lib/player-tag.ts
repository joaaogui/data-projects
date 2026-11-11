export const DEFAULT_PLAYER_TAG = "VGURQ0QQ2";
export const PLAYER_TAG_STORAGE_KEY = "clash-deck-advisor:player-tag:v1";

export function normalizePlayerTagValue(value: string): string {
  return value.trim().replace(/^#+/, "").toUpperCase();
}

export function isValidPlayerTag(value: string): boolean {
  return /^[A-Z0-9]{3,15}$/.test(normalizePlayerTagValue(value));
}
