CREATE TABLE "household_preferences" (
	"household_id" text PRIMARY KEY NOT NULL,
	"default_servings" integer DEFAULT 2 NOT NULL,
	CONSTRAINT "household_preferences_servings_check" CHECK ("household_preferences"."default_servings" between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "pantry_item" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"staple" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pantry_item_quantity_check" CHECK ("pantry_item"."quantity" >= 0 and "pantry_item"."quantity" <= 1000000000000),
	CONSTRAINT "pantry_item_version_check" CHECK ("pantry_item"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "pantry_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"previous_quantity" double precision NOT NULL,
	"quantity" double precision NOT NULL,
	"previous_staple" boolean NOT NULL,
	"staple" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pantry_movement_quantity_check" CHECK ("pantry_movement"."previous_quantity" >= 0 and "pantry_movement"."previous_quantity" <= 1000000000000 and "pantry_movement"."quantity" >= 0 and "pantry_movement"."quantity" <= 1000000000000),
	CONSTRAINT "pantry_movement_kind_check" CHECK ("pantry_movement"."kind" in ('count', 'correction', 'removed', 'cooked'))
);
--> statement-breakpoint
ALTER TABLE "household_preferences" ADD CONSTRAINT "household_preferences_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_movement" ADD CONSTRAINT "pantry_movement_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_movement" ADD CONSTRAINT "pantry_movement_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_movement" ADD CONSTRAINT "pantry_movement_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_item_household_ingredient_uq" ON "pantry_item" USING btree ("household_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "pantry_movement_household_ingredient_idx" ON "pantry_movement" USING btree ("household_id","ingredient_id","created_at");