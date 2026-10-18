CREATE TABLE "housing"."runtime_kv" (
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_kv_namespace_key_pk" PRIMARY KEY("namespace","key")
);
--> statement-breakpoint
CREATE TABLE "housing"."snapshot_pointer" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housing"."snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "housing"."snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_hash" text NOT NULL,
	"contract_version" integer NOT NULL,
	"property_count" integer NOT NULL,
	"source_updated_at" text NOT NULL,
	"payload_gzip" "bytea" NOT NULL,
	"galleries_gzip" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
ALTER TABLE "housing"."snapshot_pointer" ADD CONSTRAINT "snapshot_pointer_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "housing"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "housing_runtime_kv_ns_updated_idx" ON "housing"."runtime_kv" USING btree ("namespace","updated_at");