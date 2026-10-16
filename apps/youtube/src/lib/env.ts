import "server-only";
import { loadServerEnv } from "@data-projects/shared/env";
import { z } from "zod";

const envSchema = z.object({
  POSTGRES_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  ALLOWED_EMAILS: z.string().optional(),
  /** When "true", empty ALLOWED_EMAILS permits any Google account. Default: fail closed. */
  ALLOW_PUBLIC_AUTH: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  SYNC_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = loadServerEnv(envSchema, {
  POSTGRES_URL: "postgresql://build:build@localhost/build",
  AUTH_SECRET: "build-secret",
  AUTH_GOOGLE_ID: "build-google-id",
  AUTH_GOOGLE_SECRET: "build-google-secret",
  YOUTUBE_API_KEY: "build-api-key",
});

export const allowedEmails = (env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Empty allow-list is public only when ALLOW_PUBLIC_AUTH is explicitly true. */
export const allowPublicAuth = env.ALLOW_PUBLIC_AUTH === "true";
