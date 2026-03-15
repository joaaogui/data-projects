import { z } from "zod";

const envSchema = z.object({
  POSTGRES_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  ALLOWED_EMAILS: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  SYNC_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;
  if (isTest) {
    return {
      POSTGRES_URL: "postgresql://test:test@localhost/test",
      AUTH_SECRET: "test-secret",
      AUTH_GOOGLE_ID: "test-google-id",
      AUTH_GOOGLE_SECRET: "test-google-secret",
      YOUTUBE_API_KEY: "test-api-key",
      ...process.env,
    } as Env;
  }
  throw result.error;
}

export const env = loadEnv();

export const allowedEmails = (env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
