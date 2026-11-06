CREATE TABLE "made_deduction" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"event_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity" double precision NOT NULL,
	"movement_id" text NOT NULL,
	CONSTRAINT "made_deduction_quantity_check" CHECK ("made_deduction"."quantity" > 0 and "made_deduction"."quantity" <= 1000000000000)
);
--> statement-breakpoint
CREATE TABLE "made_event" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"planned_meal_id" text,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"date" date NOT NULL,
	"servings" integer NOT NULL,
	"recipe_version" integer NOT NULL,
	"request_id" text NOT NULL,
	"input_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "made_event_servings_check" CHECK ("made_event"."servings" between 1 and 1000),
	CONSTRAINT "made_event_version_check" CHECK ("made_event"."recipe_version" > 0),
	CONSTRAINT "made_event_date_check" CHECK ("made_event"."date" between '0001-01-01'::date and '9999-12-31'::date)
);
--> statement-breakpoint
CREATE TABLE "made_rating" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"score" integer,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "made_rating_score_check" CHECK ("made_rating"."score" is null or "made_rating"."score" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "made_deduction" ADD CONSTRAINT "made_deduction_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_deduction" ADD CONSTRAINT "made_deduction_event_id_made_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."made_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_deduction" ADD CONSTRAINT "made_deduction_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_deduction" ADD CONSTRAINT "made_deduction_movement_id_pantry_movement_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."pantry_movement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_event" ADD CONSTRAINT "made_event_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_event" ADD CONSTRAINT "made_event_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_event" ADD CONSTRAINT "made_event_planned_meal_id_planned_meal_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_event" ADD CONSTRAINT "made_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_rating" ADD CONSTRAINT "made_rating_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_rating" ADD CONSTRAINT "made_rating_event_id_made_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."made_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_rating" ADD CONSTRAINT "made_rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "made_deduction_event_ingredient_uq" ON "made_deduction" USING btree ("event_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "made_event_request_uq" ON "made_event" USING btree ("household_id","request_id");--> statement-breakpoint
CREATE INDEX "made_event_household_date_idx" ON "made_event" USING btree ("household_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "made_rating_event_user_uq" ON "made_rating" USING btree ("event_id","user_id");