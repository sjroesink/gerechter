CREATE TABLE "recipe" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"servings" integer NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"source_url" text,
	"photo_url" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_servings_check" CHECK ("recipe"."servings" between 1 and 1000),
	CONSTRAINT "recipe_version_check" CHECK ("recipe"."version" > 0),
	CONSTRAINT "recipe_times_check" CHECK (("recipe"."prep_minutes" is null or "recipe"."prep_minutes" between 0 and 10080) and ("recipe"."cook_minutes" is null or "recipe"."cook_minutes" between 0 and 10080))
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity" double precision,
	"unit" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "recipe_ingredient_quantity_check" CHECK ("recipe_ingredient"."quantity" is null or ("recipe_ingredient"."quantity" > 0 and "recipe_ingredient"."quantity" <= 1000000000)),
	CONSTRAINT "recipe_ingredient_position_check" CHECK ("recipe_ingredient"."position" >= 0),
	CONSTRAINT "recipe_ingredient_unit_check" CHECK ("recipe_ingredient"."unit" in ('g','kg','ml','l','tl','el','stuk','teen','blik','pak','bos','plak','snuf','handje','scheut'))
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_household_idx" ON "recipe" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "recipe_name_trgm_idx" ON "recipe" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipe_tags_idx" ON "recipe" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_ingredient_position_uq" ON "recipe_ingredient" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_household_idx" ON "recipe_ingredient" USING btree ("household_id","recipe_id");