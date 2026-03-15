CREATE TABLE "saga_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"action" text NOT NULL,
	"video_id" text NOT NULL,
	"video_title" text NOT NULL,
	"video_published_at" timestamp with time zone NOT NULL,
	"target_saga_id" text,
	"target_saga_name" text,
	"previous_saga_id" text,
	"previous_saga_name" text,
	"neighbor_context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"label" text,
	"pinned" integer DEFAULT 0 NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"channel_title" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "subscriber_count" bigint;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "total_view_count" bigint;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "video_count" integer;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "custom_url" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "sagas" ADD COLUMN "video_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "sagas" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "saga_corrections" ADD CONSTRAINT "saga_corrections_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_channels" ADD CONSTRAINT "saved_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saga_corrections_channel_idx" ON "saga_corrections" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "saga_corrections_channel_date_idx" ON "saga_corrections" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_channels_user_idx" ON "saved_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_channels_user_channel_idx" ON "saved_channels" USING btree ("user_id","channel_id");--> statement-breakpoint
CREATE INDEX "sagas_channel_source_idx" ON "sagas" USING btree ("channel_id","source");--> statement-breakpoint
CREATE INDEX "sync_jobs_cleanup_idx" ON "sync_jobs" USING btree ("channel_id","type","status","updated_at");