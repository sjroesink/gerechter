CREATE TABLE "shopping_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"target" text NOT NULL,
	"destination_id" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_connection_target_check" CHECK ("shopping_connection"."target" in ('notion', 'ah')),
	CONSTRAINT "shopping_connection_version_check" CHECK ("shopping_connection"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"request_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"target" text NOT NULL,
	"target_key" text NOT NULL,
	"connection_id" text,
	"source" jsonb NOT NULL,
	"source_keys" text[] NOT NULL,
	"fingerprint" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_id" text,
	"external_url" text,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_run_target_check" CHECK ("sync_run"."target" in ('share','notion','ah')),
	CONSTRAINT "sync_run_status_check" CHECK ("sync_run"."status" in ('pending','succeeded','failed','uncertain','copied','shared','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sync_source_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"target_key" text NOT NULL,
	"source_key" text NOT NULL,
	"run_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_connection" ADD CONSTRAINT "shopping_connection_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_connection_id_shopping_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."shopping_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_source_claim" ADD CONSTRAINT "sync_source_claim_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_source_claim" ADD CONSTRAINT "sync_source_claim_run_id_sync_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sync_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_connection_household_target_uq" ON "shopping_connection" USING btree ("household_id","target");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_run_request_uq" ON "sync_run" USING btree ("household_id","request_id");--> statement-breakpoint
CREATE INDEX "sync_run_household_created_idx" ON "sync_run" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_source_claim_uq" ON "sync_source_claim" USING btree ("household_id","target_key","source_key");