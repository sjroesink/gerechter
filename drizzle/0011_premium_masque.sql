CREATE TABLE "ingredient_ah_product" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"title" text NOT NULL,
	"unit_size" text,
	"image_url" text,
	"pack_amount" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_ah_product_product_id_check" CHECK ("ingredient_ah_product"."product_id" > 0),
	CONSTRAINT "ingredient_ah_product_pack_amount_check" CHECK ("ingredient_ah_product"."pack_amount" is null or ("ingredient_ah_product"."pack_amount" > 0 and "ingredient_ah_product"."pack_amount" <= 1000000000))
);
--> statement-breakpoint
ALTER TABLE "ingredient_ah_product" ADD CONSTRAINT "ingredient_ah_product_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_ah_product" ADD CONSTRAINT "ingredient_ah_product_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_ah_product_household_ingredient_uq" ON "ingredient_ah_product" USING btree ("household_id","ingredient_id");