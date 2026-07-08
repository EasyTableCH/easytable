CREATE TABLE IF NOT EXISTS "order_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"local_master_instance_id" text NOT NULL,
	"order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"snapshot_type" text NOT NULL,
	"table_context_json" jsonb,
	"subtotal" integer NOT NULL,
	"tax_total" integer NOT NULL,
	"total" integer NOT NULL,
	"payment_id" text NOT NULL,
	"payment_request_id" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_amount" integer NOT NULL,
	"payment_terminal_id" text,
	"provider" text NOT NULL,
	"provider_transaction_id" text,
	"provider_status" text NOT NULL,
	"payment_lifecycle_state" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"terminal_id" text,
	"business_date" text NOT NULL,
	"local_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_snapshot_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"local_master_instance_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"order_id" text NOT NULL,
	"line_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_type" text NOT NULL,
	"product_name" text NOT NULL,
	"product_category" text NOT NULL,
	"base_price" integer NOT NULL,
	"tax_code_id" text NOT NULL,
	"tax_code_name" text NOT NULL,
	"tax_rate_bps" integer NOT NULL,
	"station" text NOT NULL,
	"variants_json" jsonb NOT NULL,
	"unit_total" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" integer NOT NULL,
	"local_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"local_master_instance_id" text NOT NULL,
	"request_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"payment_id" text,
	"original_entry_id" text,
	"line_id" text,
	"product_id" text,
	"product_name" text,
	"product_category" text,
	"quantity" integer NOT NULL,
	"gross_amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"payment_method" text,
	"terminal_id" text,
	"provider" text,
	"provider_transaction_id" text,
	"provider_refund_id" text,
	"provider_status" text,
	"reason" text,
	"business_date" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "local_master_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"local_master_instance_id" text NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"local_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_snapshots" ADD CONSTRAINT "order_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_snapshot_lines" ADD CONSTRAINT "order_snapshot_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_snapshot_lines" ADD CONSTRAINT "order_snapshot_lines_snapshot_id_order_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."order_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_ledger_entries" ADD CONSTRAINT "sales_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_master_outbox_events" ADD CONSTRAINT "local_master_outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_order_snapshots_local" ON "order_snapshots" USING btree ("tenant_id","location_id","local_master_instance_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_order_snapshots_local_order" ON "order_snapshots" USING btree ("tenant_id","location_id","local_master_instance_id","order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_snapshots_reporting" ON "order_snapshots" USING btree ("tenant_id","location_id","business_date","local_created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_snapshots_payment" ON "order_snapshots" USING btree ("tenant_id","location_id","payment_method","payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_snapshots_terminal" ON "order_snapshots" USING btree ("tenant_id","location_id","terminal_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_order_snapshot_lines_local" ON "order_snapshot_lines" USING btree ("tenant_id","location_id","local_master_instance_id","snapshot_id","line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_snapshot_lines_order" ON "order_snapshot_lines" USING btree ("tenant_id","location_id","order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_snapshot_lines_product" ON "order_snapshot_lines" USING btree ("tenant_id","location_id","product_id","product_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sales_ledger_local" ON "sales_ledger_entries" USING btree ("tenant_id","location_id","local_master_instance_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_ledger_reporting" ON "sales_ledger_entries" USING btree ("tenant_id","location_id","business_date","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_ledger_order" ON "sales_ledger_entries" USING btree ("tenant_id","location_id","order_id","entry_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_ledger_method" ON "sales_ledger_entries" USING btree ("tenant_id","location_id","payment_method","business_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_ledger_terminal" ON "sales_ledger_entries" USING btree ("tenant_id","location_id","terminal_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_local_master_outbox_events_local" ON "local_master_outbox_events" USING btree ("tenant_id","location_id","local_master_instance_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_local_master_outbox_events_reporting" ON "local_master_outbox_events" USING btree ("tenant_id","location_id","local_created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_local_master_outbox_events_aggregate" ON "local_master_outbox_events" USING btree ("tenant_id","location_id","aggregate_id");
