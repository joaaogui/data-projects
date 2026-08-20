import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 150;

const sleep = (ms: number) => new Promise((r) => globalThis.setTimeout(r, ms));

/**
 * Neon's HTTP driver issues one request per statement, so a dropped connection
 * surfaces as a failed query rather than something the pool can paper over.
 * Retry only when fetch itself throws: that means the request never reached the
 * server, so replaying it cannot duplicate a write. Anything that came back
 * with a response -- including an error status -- is passed straight through.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
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

function createDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing required environment variable: POSTGRES_URL");
  neonConfig.fetchFunction = fetchWithRetry;
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb>;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    _db ??= createDb();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
