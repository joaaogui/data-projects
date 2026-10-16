import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalizeKey(name: string): string {
  return name.trim().toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

function fallbackCopy(value: string): boolean {
  if (typeof document === "undefined") return false;
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  } catch {
    try {
      return fallbackCopy(text);
    } catch {
      return false;
    }
  }
}

export function readLocalStorageJson<T>(
  key: string,
  fallback: T,
  parse?: (raw: unknown) => T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parse ? parse(parsed) : (parsed as T);
  } catch {
    return fallback;
  }
}

export function writeLocalStorageJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
}

export function toggleExclusiveListItem(
  primary: readonly string[],
  secondary: readonly string[],
  item: string,
  maxItems: number,
  keyFn: (value: string) => string = normalizeKey,
): [string[], string[]] {
  const targetKey = keyFn(item);
  const isPresent = primary.some((entry) => keyFn(entry) === targetKey);
  const nextPrimary = isPresent
    ? primary.filter((entry) => keyFn(entry) !== targetKey)
    : [...primary, item].slice(-maxItems);
  const nextSecondary = secondary.filter(
    (entry) => keyFn(entry) !== targetKey,
  );
  return [nextPrimary, nextSecondary];
}
