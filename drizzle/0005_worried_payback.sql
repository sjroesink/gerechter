CREATE TABLE "planned_meal" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"recipe_id" text,
	"title" text,
	"servings" integer,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planned_meal_shape_check" CHECK (("planned_meal"."kind" = 'recipe' and "planned_meal"."recipe_id" is not null and "planned_meal"."title" is null) or ("planned_meal"."kind" = 'free' and "planned_meal"."recipe_id" is null and "planned_meal"."servings" is null and length(trim("planned_meal"."title")) > 0 and "planned_meal"."title" is not null)),
	CONSTRAINT "planned_meal_servings_check" CHECK ("planned_meal"."servings" is null or "planned_meal"."servings" between 1 and 1000),
	CONSTRAINT "planned_meal_version_check" CHECK ("planned_meal"."version" > 0),
	CONSTRAINT "planned_meal_date_check" CHECK ("planned_meal"."date" between '0001-01-01'::date and '9999-12-31'::date)
);
--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planned_meal_household_date_idx" ON "planned_meal" USING btree ("household_id","date");