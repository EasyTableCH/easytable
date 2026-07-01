CREATE TABLE `catalog_output_stations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_active` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_output_stations_tenant` ON `catalog_output_stations` (`tenant_id`,`is_active`,`sort_order`);--> statement-breakpoint
INSERT INTO `catalog_output_stations` (`id`, `tenant_id`, `name`, `kind`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
	('station_shisha', 'tenant_basilica', 'Shisha', 'KDS_AND_PRINTER', 1, 10, CAST(strftime('%s', 'now') AS integer) * 1000, CAST(strftime('%s', 'now') AS integer) * 1000),
	('station_bar', 'tenant_basilica', 'Bar', 'KDS_AND_PRINTER', 1, 20, CAST(strftime('%s', 'now') AS integer) * 1000, CAST(strftime('%s', 'now') AS integer) * 1000),
	('station_snack', 'tenant_basilica', 'Snack', 'KDS_AND_PRINTER', 1, 30, CAST(strftime('%s', 'now') AS integer) * 1000, CAST(strftime('%s', 'now') AS integer) * 1000)
ON CONFLICT(`id`) DO NOTHING;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`tax_id` text,
	`product_type` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`tax_code_id` text NOT NULL,
	`tax_code_name` text NOT NULL,
	`tax_rate_bps` integer NOT NULL,
	`is_available` integer NOT NULL,
	`station` text DEFAULT '' NOT NULL,
	`station_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `catalog_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`station_id`) REFERENCES `catalog_output_stations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_catalog_products`("id", "category_id", "tax_id", "product_type", "name", "price", "tax_code_id", "tax_code_name", "tax_rate_bps", "is_available", "station", "station_id", "created_at", "updated_at")
SELECT
	"id",
	"category_id",
	"tax_id",
	"product_type",
	"name",
	"price",
	"tax_code_id",
	"tax_code_name",
	"tax_rate_bps",
	"is_available",
	"station",
	CASE
		WHEN "category_id" = 'cat_shisha' THEN 'station_shisha'
		WHEN lower("station") = 'shisha' THEN 'station_shisha'
		WHEN lower("station") = 'bar' THEN 'station_bar'
		WHEN lower("station") = 'snack' THEN 'station_snack'
		ELSE NULL
	END,
	"created_at",
	"updated_at"
FROM `catalog_products`;--> statement-breakpoint
DROP TABLE `catalog_products`;--> statement-breakpoint
ALTER TABLE `__new_catalog_products` RENAME TO `catalog_products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_catalog_products_category` ON `catalog_products` (`category_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_station` ON `catalog_products` (`station_id`,`product_type`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_tax` ON `catalog_products` (`tax_id`,`name`);
