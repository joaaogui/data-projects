CREATE SCHEMA "housing";
--> statement-breakpoint
CREATE TABLE "housing"."neighborhoods" (
	"city_code" text NOT NULL,
	"neighborhood" text NOT NULL,
	"city_name" text NOT NULL,
	"overall_position" integer NOT NULL,
	"city_position" integer NOT NULL,
	"base_score" real NOT NULL,
	"idhm" real NOT NULL,
	"commute_time" text NOT NULL,
	"nubank_hub" text NOT NULL,
	"urban_breathing_score" real NOT NULL,
	"commute_logistics_score" real NOT NULL,
	"building_stock_fit_score" real NOT NULL,
	"budget_fit_score" real NOT NULL,
	"safety_car_score" real NOT NULL,
	"short_rationale" text NOT NULL,
	"detailed_justification" text NOT NULL,
	"pros" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "neighborhoods_city_code_neighborhood_pk" PRIMARY KEY("city_code","neighborhood")
);
--> statement-breakpoint
CREATE TABLE "housing"."properties" (
	"provider" text NOT NULL,
	"id" text NOT NULL,
	"city_code" text NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text NOT NULL,
	"street" text NOT NULL,
	"street_number" text,
	"condominium_name" text,
	"doorman" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"rent" integer NOT NULL,
	"condo_fee" integer NOT NULL,
	"iptu" integer NOT NULL,
	"total_monthly" integer NOT NULL,
	"sale_price" integer,
	"area_m2" real NOT NULL,
	"bedrooms" integer NOT NULL,
	"suites" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"parking_spaces" integer NOT NULL,
	"floor" integer,
	"floor_range" jsonb,
	"total_floors" integer,
	"furnished" boolean,
	"accepts_pets" boolean,
	"near_subway" boolean,
	"construction_year" integer,
	"condition" text,
	"installations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comfort_commodities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practicality_commodities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"places_nearby" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_captions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photos_count" integer DEFAULT 0 NOT NULL,
	"modernity_score" integer NOT NULL,
	"modernity_tier" text NOT NULL,
	"positive_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"negative_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"generated_description" text,
	"source_search" text,
	"is_new_entry" boolean DEFAULT false NOT NULL,
	"published_at" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_provider_id_pk" PRIMARY KEY("provider","id")
);
--> statement-breakpoint
CREATE TABLE "housing"."property_qa" (
	"id" text PRIMARY KEY NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housing"."user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active_preset_id" text DEFAULT 'balanced-original' NOT NULL,
	"favorites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compare_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housing"."weight_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weights" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "housing_nb_pos_idx" ON "housing"."neighborhoods" USING btree ("overall_position");--> statement-breakpoint
CREATE INDEX "housing_prop_city_nb_idx" ON "housing"."properties" USING btree ("city_code","neighborhood");--> statement-breakpoint
CREATE INDEX "housing_prop_total_idx" ON "housing"."properties" USING btree ("city_code","total_monthly");