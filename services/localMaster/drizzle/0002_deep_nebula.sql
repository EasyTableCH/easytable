CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`address` text,
	`local_master_instance_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_locations_tenant_slug` ON `locations` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_locations_tenant` ON `locations` (`tenant_id`,`status`,`name`);--> statement-breakpoint
CREATE INDEX `idx_locations_local_master` ON `locations` (`local_master_instance_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`email` text,
	`phone` text,
	`website` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenants_slug` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenants_status` ON `tenants` (`status`,`name`);