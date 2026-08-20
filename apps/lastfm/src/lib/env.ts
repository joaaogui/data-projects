// Everything downstream of this file reads the database or the Last.fm key.
// Importing it from a client component is always a mistake -- this turns that
// into a build error naming the offending file, rather than a Zod failure in
// the browser about a variable that could never have been there.
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  POSTGRES_URL: z.string().min(1),
  LASTFM_API_KEY: z.string().min(1),
  LASTFM_USERNAME: z.string().min(1),
  /** IANA zone used to bucket scrobbles by local hour/day. Stored data is UTC. */
  LASTFM_TIMEZONE: z.string().default("America/Sao_Paulo"),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const skipValidation =
  process.env.NODE_ENV === "test" ||
  !!process.env.VITEST ||
  !!process.env.CI ||
  !!process.env.SKIP_ENV_VALIDATION;

const BUILD_DEFAULTS: Env = {
  POSTGRES_URL: "postgresql://build:build@localhost/build",
  LASTFM_API_KEY: "build-api-key",
  LASTFM_USERNAME: "build-user",
  LASTFM_TIMEZONE: "America/Sao_Paulo",
};

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;
  if (skipValidation) return { ...BUILD_DEFAULTS, ...process.env } as Env;
  throw result.error;
}

export const env = loadEnv();
