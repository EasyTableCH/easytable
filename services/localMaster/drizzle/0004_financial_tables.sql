CREATE TABLE IF NOT EXISTS `order_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_number` text NOT NULL,
	`snapshot_type` text NOT NULL,
	`table_context_json` text,
	`subtotal` integer NOT NULL,
	`tax_total` integer NOT NULL,
	`total` integer NOT NULL,
	`payment_id` text NOT NULL,
	`payment_request_id` text NOT NULL,
	`payment_method` text NOT NULL,
	`payment_amount` integer NOT NULL,
	`payment_terminal_id` text,
	`provider` text NOT NULL,
	`provider_transaction_id` text,
	`provider_status` text NOT NULL,
	`payment_lifecycle_state` text NOT NULL,
	`paid_at` integer NOT NULL,
	`terminal_id` text,
	`business_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_order_snapshots_order` ON `order_snapshots` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_snapshots_business_date` ON `order_snapshots` (`business_date`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_snapshots_payment` ON `order_snapshots` (`payment_method`,`payment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_snapshots_terminal` ON `order_snapshots` (`terminal_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_snapshot_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`order_id` text NOT NULL,
	`line_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_type` text NOT NULL,
	`product_name` text NOT NULL,
	`product_category` text NOT NULL,
	`base_price` integer NOT NULL,
	`tax_code_id` text NOT NULL,
	`tax_code_name` text NOT NULL,
	`tax_rate_bps` integer NOT NULL,
	`station` text NOT NULL,
	`variants_json` text NOT NULL,
	`unit_total` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `order_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_order_snapshot_lines_snapshot_line` ON `order_snapshot_lines` (`snapshot_id`,`line_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_snapshot_lines_order` ON `order_snapshot_lines` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_snapshot_lines_product` ON `order_snapshot_lines` (`product_id`,`product_name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sales_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`order_id` text NOT NULL,
	`order_number` text NOT NULL,
	`payment_id` text,
	`original_entry_id` text,
	`line_id` text,
	`product_id` text,
	`product_name` text,
	`product_category` text,
	`quantity` integer NOT NULL,
	`gross_amount` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`payment_method` text,
	`terminal_id` text,
	`provider` text,
	`provider_transaction_id` text,
	`provider_refund_id` text,
	`provider_status` text,
	`reason` text,
	`business_date` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sales_ledger_business_date` ON `sales_ledger_entries` (`business_date`,`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sales_ledger_order` ON `sales_ledger_entries` (`order_id`,`entry_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sales_ledger_payment` ON `sales_ledger_entries` (`payment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sales_ledger_method` ON `sales_ledger_entries` (`payment_method`,`business_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sales_ledger_terminal` ON `sales_ledger_entries` (`terminal_id`,`business_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `local_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`synced_at` integer,
	`sync_attempt_count` integer DEFAULT 0 NOT NULL,
	`last_sync_error` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_local_outbox_pending` ON `local_outbox` (`synced_at`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_local_outbox_aggregate` ON `local_outbox` (`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `command_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`command_type` text NOT NULL,
	`request_id` text NOT NULL,
	`payload_fingerprint` text NOT NULL,
	`status` text NOT NULL,
	`result_json` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_command_inbox_command_request` ON `command_inbox` (`command_type`,`request_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_command_inbox_status` ON `command_inbox` (`status`,`updated_at`);
