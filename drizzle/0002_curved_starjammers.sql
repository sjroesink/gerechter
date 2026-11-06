CREATE TABLE "ingredient" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"base_unit" text NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_base_unit_check" CHECK ("ingredient"."base_unit" in ('g', 'ml', 'stuk'))
);
--> statement-breakpoint
CREATE TABLE "ingredient_conversion" (
	"id" text PRIMARY KEY NOT NULL,
	"ingredient_id" text NOT NULL,
	"unit" text NOT NULL,
	"factor" double precision NOT NULL,
	CONSTRAINT "ingredient_conversion_factor_check" CHECK ("ingredient_conversion"."factor" > 0 and "ingredient_conversion"."factor" <= 1000000000),
	CONSTRAINT "ingredient_conversion_unit_check" CHECK ("ingredient_conversion"."unit" in ('g', 'ml', 'stuk', 'teen', 'blik', 'pak', 'bos', 'plak'))
);
--> statement-breakpoint
ALTER TABLE "ingredient" ADD CONSTRAINT "ingredient_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_conversion" ADD CONSTRAINT "ingredient_conversion_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_global_name_uq" ON "ingredient" USING btree ("normalized_name") WHERE "ingredient"."household_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_household_name_uq" ON "ingredient" USING btree ("household_id","normalized_name") WHERE "ingredient"."household_id" is not null;--> statement-breakpoint
CREATE INDEX "ingredient_name_trgm_idx" ON "ingredient" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_conversion_unit_uq" ON "ingredient_conversion" USING btree ("ingredient_id","unit");