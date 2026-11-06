CREATE TABLE "image" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "image_content_type_check" CHECK ("image"."content_type" in ('image/jpeg','image/png','image/webp','image/gif','image/avif')),
	CONSTRAINT "image_byte_size_check" CHECK ("image"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "photo_image_id" text;--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_household_idx" ON "image" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_photo_image_id_image_id_fk" FOREIGN KEY ("photo_image_id") REFERENCES "public"."image"("id") ON DELETE set null ON UPDATE no action;