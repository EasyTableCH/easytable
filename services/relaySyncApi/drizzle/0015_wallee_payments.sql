CREATE TABLE IF NOT EXISTS "wallee_payment_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text,
	"space_id" text NOT NULL,
	"application_user_id" text NOT NULL,
	"application_user_secret_encrypted" text NOT NULL,
	"webhook_signature_key" text,
	"mode" text DEFAULT 'CLOUD_TILL_LONG_POLLING' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallee_payment_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "wallee_payment_profiles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wallee_profiles_location" ON "wallee_payment_profiles" USING btree ("tenant_id","location_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallee_profiles_tenant" ON "wallee_payment_profiles" USING btree ("tenant_id","enabled");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallee_payment_terminals" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text,
	"display_name" text NOT NULL,
	"terminal_id" text,
	"terminal_identifier" text,
	"is_default" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallee_payment_terminals_profile_id_wallee_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wallee_payment_profiles"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "wallee_payment_terminals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "wallee_payment_terminals_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallee_terminals_profile" ON "wallee_payment_terminals" USING btree ("profile_id","is_active","display_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallee_terminals_location" ON "wallee_payment_terminals" USING btree ("tenant_id","location_id","is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallee_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"event_id" text NOT NULL,
	"entity_id" text,
	"listener_entity_id" text,
	"listener_entity_technical_name" text,
	"payload_json" jsonb NOT NULL,
	"signature" text,
	"status" text NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallee_webhook_events_profile_id_wallee_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wallee_payment_profiles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wallee_webhook_events_event" ON "wallee_webhook_events" USING btree ("profile_id","event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallee_webhook_events_status" ON "wallee_webhook_events" USING btree ("profile_id","status","created_at");
