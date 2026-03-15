CREATE TABLE IF NOT EXISTS "shared_comparisons" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_ids" jsonb NOT NULL,
  "channel_titles" jsonb NOT NULL,
  "snapshot_data" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
