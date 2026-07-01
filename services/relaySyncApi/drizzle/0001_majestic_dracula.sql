ALTER TABLE "locations" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "website" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_locations_tenant_slug" ON "locations" USING btree ("tenant_id","slug");