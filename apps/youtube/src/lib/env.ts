function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  POSTGRES_URL: required("POSTGRES_URL"),
  AUTH_SECRET: required("AUTH_SECRET"),
  AUTH_GOOGLE_ID: required("AUTH_GOOGLE_ID"),
  AUTH_GOOGLE_SECRET: required("AUTH_GOOGLE_SECRET"),
  YOUTUBE_API_KEY: required("YOUTUBE_API_KEY"),
  ALLOWED_EMAILS: optional("ALLOWED_EMAILS"),
  GROQ_API_KEY: optional("GROQ_API_KEY"),
  GOOGLE_AI_API_KEY: optional("GOOGLE_AI_API_KEY"),
  SYNC_SECRET: optional("SYNC_SECRET"),
  NEXT_PUBLIC_POSTHOG_KEY: optional("NEXT_PUBLIC_POSTHOG_KEY"),
} as const;
