import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 150;

const sleep = (ms: number) => new Promise((r) => globalThis.setTimeout(r, ms));

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

export type ClashDatabase = NeonHttpDatabase<typeof schema>;

let cachedDb: ClashDatabase | null | undefined;
let cachedUrl: string | undefined;

export function getDb(): ClashDatabase | null {
  const url = (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    ""
  ).trim();
  if (!url) {
    return null;
  }
  if (cachedDb && cachedUrl === url) {
    return cachedDb;
  }
  neonConfig.fetchFunction = fetchWithRetry;
  const sql = neon(url);
  cachedDb = drizzle(sql, { schema });
  cachedUrl = url;
  return cachedDb;
}
