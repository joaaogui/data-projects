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
ALTER TABLE "saga_corrections" ADD CONSTRAINT "saga_corrections_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saga_corrections_channel_idx" ON "saga_corrections" USING btree ("channel_id");
