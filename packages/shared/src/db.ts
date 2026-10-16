import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { sleep } from "./utils";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 150;

/**
 * Neon's HTTP driver issues one request per statement, so a dropped connection
 * surfaces as a failed query rather than something the pool can paper over.
 * Retry only when fetch itself throws: that means the request never reached the
 * server, so replaying it cannot duplicate a write. Anything that came back
 * with a response -- including an error status -- is passed straight through.
 */
export async function fetchWithRetry(
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

export function createNeonHttpDb<TSchema extends Record<string, unknown>>(
  schema: TSchema,
  connectionString = process.env.POSTGRES_URL,
): NeonHttpDatabase<TSchema> {
  const url = connectionString?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: POSTGRES_URL");
  }
  neonConfig.fetchFunction = fetchWithRetry;
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export function createLazyNeonHttpDb<TSchema extends Record<string, unknown>>(
  schema: TSchema,
): NeonHttpDatabase<TSchema> {
  let instance: NeonHttpDatabase<TSchema> | undefined;

  return new Proxy({} as NeonHttpDatabase<TSchema>, {
    get(_target, prop) {
      instance ??= createNeonHttpDb(schema);
      return (instance as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
}

export function createOptionalNeonHttpDb<
  TSchema extends Record<string, unknown>,
>(schema: TSchema): () => NeonHttpDatabase<TSchema> | null {
  let cachedDb: NeonHttpDatabase<TSchema> | null | undefined;
  let cachedUrl: string | undefined;

  return function getDb(): NeonHttpDatabase<TSchema> | null {
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
    cachedDb = createNeonHttpDb(schema, url);
    cachedUrl = url;
    return cachedDb;
  };
}

export type { NeonHttpDatabase };
