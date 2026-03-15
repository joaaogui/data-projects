-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- Trigram index on channels.title for fast ILIKE/autocomplete queries
CREATE INDEX IF NOT EXISTS channels_title_trgm_idx ON channels USING gin (title gin_trgm_ops);
--> statement-breakpoint

-- GIN index on videos.topics (JSONB array) for topic-based filtering
CREATE INDEX IF NOT EXISTS videos_topics_gin_idx ON videos USING gin (topics jsonb_path_ops);
--> statement-breakpoint

-- Index on shared_reports for expiration cleanup
CREATE INDEX IF NOT EXISTS shared_reports_expires_idx ON shared_reports (expires_at) WHERE expires_at IS NOT NULL;
