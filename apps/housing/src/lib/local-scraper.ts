import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The scraper workspace lives on the owner's Mac (`HOUSING_SCRAPER_DIR`). Features that need it
 * (scrape jobs, Playwright photo fallback, Cursor question queue) return null elsewhere, so a
 * Vercel deployment never depends on a local path.
 */
export function getLocalScraperDir(): string | null {
  if (process.env.VERCEL) return null;
  const dir = process.env.HOUSING_SCRAPER_DIR?.trim();
  if (!dir || !existsSync(/*turbopackIgnore: true*/ dir)) return null;
  return dir;
}

export function getCardQuestionsQueueFile(): string | null {
  const dir = getLocalScraperDir();
  return dir ? join(dir, ".card-questions-queue.jsonl") : null;
}
