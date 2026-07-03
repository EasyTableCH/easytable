ALTER TABLE "users" ADD COLUMN "password_hash" text;
CREATE TABLE "tenant_user_locations" (
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"user_id" text NOT NULL,
	"pin_hash" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_user_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "tenant_user_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "tenant_user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX "idx_tenant_user_locations_unique" ON "tenant_user_locations" USING btree ("tenant_id","location_id","user_id");
CREATE INDEX "idx_tenant_user_locations_location" ON "tenant_user_locations" USING btree ("tenant_id","location_id","is_active");
