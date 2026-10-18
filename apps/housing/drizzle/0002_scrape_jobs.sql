CREATE TABLE "housing"."scrape_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"mode" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress" jsonb,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"requested_by" text DEFAULT 'portal' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "housing_scrape_jobs_status_idx" ON "housing"."scrape_jobs" USING btree ("status","requested_at");