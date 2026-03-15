CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "image" text,
  "plan" text DEFAULT 'free' NOT NULL,
  "sync_quota_daily" integer DEFAULT 10 NOT NULL,
  "sync_usage_today" integer DEFAULT 0 NOT NULL,
  "sync_usage_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
