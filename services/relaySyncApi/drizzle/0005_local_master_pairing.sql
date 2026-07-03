ALTER TABLE "locations" ADD CONSTRAINT "idx_locations_local_master_instance" UNIQUE("local_master_instance_id");
CREATE TABLE "local_master_pairing_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"setup_code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"local_master_instance_id" text,
	"local_master_url" text,
	"pairing_result_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_master_pairing_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "local_master_pairing_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action
);
CREATE TABLE "local_master_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"local_master_instance_id" text NOT NULL,
	"token_digest" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_master_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "local_master_credentials_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "idx_local_master_pairing_sessions_location" ON "local_master_pairing_sessions" USING btree ("tenant_id","location_id","expires_at");
CREATE UNIQUE INDEX "idx_local_master_pairing_sessions_code_hash" ON "local_master_pairing_sessions" USING btree ("setup_code_hash");
CREATE UNIQUE INDEX "idx_local_master_credentials_token" ON "local_master_credentials" USING btree ("token_digest");
CREATE INDEX "idx_local_master_credentials_instance" ON "local_master_credentials" USING btree ("tenant_id","location_id","local_master_instance_id","revoked_at");
