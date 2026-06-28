use rusqlite::{params, Connection};
use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct PosDatabaseInfo {
    path: String,
    seeded_tax_codes: usize,
    seeded_products: usize,
    seeded_variant_groups: usize,
    seeded_variant_group_items: usize,
}

#[derive(Serialize)]
struct PosProduct {
    id: String,
    product_type: String,
    name: String,
    category: String,
    price: i64,
    tax_code_id: String,
    tax_code_name: String,
    tax_rate_bps: i64,
    is_available: bool,
    station: String,
}

#[derive(Serialize)]
struct PosProductVariantGroup {
    id: String,
    applies_to: String,
    product_id: Option<String>,
    category: Option<String>,
    name: String,
    selection_type: String,
    min_select: i64,
    max_select: i64,
    sort_order: i64,
    is_required: bool,
    items: Vec<PosProductVariantGroupItem>,
}

#[derive(Serialize)]
struct PosProductVariantGroupItem {
    id: String,
    variant_group_id: String,
    name: String,
    price_delta: i64,
    is_default: bool,
    sort_order: i64,
}

struct SeedTaxCode {
    id: &'static str,
    code: &'static str,
    name: &'static str,
    rate_bps: i64,
    is_default: bool,
}

struct SeedProduct {
    id: &'static str,
    product_type: &'static str,
    name: &'static str,
    category: &'static str,
    price: i64,
    tax_code_id: &'static str,
    station: &'static str,
}

struct SeedVariantGroup {
    id: &'static str,
    applies_to: &'static str,
    product_id: Option<&'static str>,
    category: Option<&'static str>,
    name: &'static str,
    selection_type: &'static str,
    min_select: i64,
    max_select: i64,
    sort_order: i64,
    is_required: bool,
}

struct SeedVariantGroupItem {
    id: &'static str,
    variant_group_id: &'static str,
    name: &'static str,
    price_delta: i64,
    is_default: bool,
    sort_order: i64,
}

const SEED_TAX_CODES: &[SeedTaxCode] = &[
    SeedTaxCode {
        id: "tax_standard_ch",
        code: "CH_STANDARD",
        name: "MwSt 8.1%",
        rate_bps: 810,
        is_default: true,
    },
    SeedTaxCode {
        id: "tax_reduced_ch",
        code: "CH_REDUCED",
        name: "MwSt 2.9%",
        rate_bps: 290,
        is_default: false,
    },
];

const SEED_PRODUCTS: &[SeedProduct] = &[
    SeedProduct {
        id: "prod_invoice",
        product_type: "SERVICE",
        name: "Rechnung",
        category: "Service",
        price: 0,
        tax_code_id: "tax_standard_ch",
        station: "SERVICE",
    },
    SeedProduct {
        id: "prod_service_personal",
        product_type: "SERVICE",
        name: "Service Personal",
        category: "Service",
        price: 0,
        tax_code_id: "tax_standard_ch",
        station: "SERVICE",
    },
    SeedProduct {
        id: "prod_shisha_standard",
        product_type: "BASIC",
        name: "Shisha Standard",
        category: "Shisha",
        price: 3000,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_nava_shisha",
        product_type: "BASIC",
        name: "NAVA Shisha",
        category: "Shisha",
        price: 5900,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_smokezilla_laser_shisha",
        product_type: "BASIC",
        name: "SmokeZilla Laser Shisha",
        category: "Shisha",
        price: 8900,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_shisha_triple_skull",
        product_type: "BASIC",
        name: "Shisha Triple Skull",
        category: "Shisha",
        price: 4500,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_neuer_kopf",
        product_type: "SERVICE",
        name: "Neuer Kopf",
        category: "Shisha",
        price: 1500,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_kohle",
        product_type: "SERVICE",
        name: "Kohle",
        category: "Shisha",
        price: 0,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_mundstucke",
        product_type: "SERVICE",
        name: "Mundstucke",
        category: "Shisha",
        price: 300,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
    SeedProduct {
        id: "prod_chinotto",
        product_type: "BASIC",
        name: "Chinotto",
        category: "Sussgetranke",
        price: 700,
        tax_code_id: "tax_standard_ch",
        station: "BAR",
    },
];

const SEED_VARIANT_GROUPS: &[SeedVariantGroup] = &[SeedVariantGroup {
    id: "vgrp_shisha_standard_head",
    applies_to: "CATEGORY",
    // Kept as a legacy anchor for dev databases created before category-scoped groups existed.
    product_id: Some("prod_shisha_standard"),
    category: Some("Shisha"),
    name: "Head",
    selection_type: "SINGLE",
    min_select: 1,
    max_select: 1,
    sort_order: 10,
    is_required: true,
}];

const SEED_VARIANT_GROUP_ITEMS: &[SeedVariantGroupItem] = &[
    SeedVariantGroupItem {
        id: "vitem_shisha_standard_head_standard",
        variant_group_id: "vgrp_shisha_standard_head",
        name: "Standard",
        price_delta: 0,
        is_default: true,
        sort_order: 10,
    },
    SeedVariantGroupItem {
        id: "vitem_shisha_standard_head_silver",
        variant_group_id: "vgrp_shisha_standard_head",
        name: "Silver",
        price_delta: 500,
        is_default: false,
        sort_order: 20,
    },
    SeedVariantGroupItem {
        id: "vitem_shisha_standard_head_premium",
        variant_group_id: "vgrp_shisha_standard_head",
        name: "Premium",
        price_delta: 1000,
        is_default: false,
        sort_order: 30,
    },
];

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;

    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Could not create app data directory: {error}"))?;

    Ok(data_dir.join("easytable-pos.sqlite3"))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    Connection::open(path).map_err(|error| format!("Could not open SQLite database: {error}"))
}

fn migrate_database(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS tax_codes (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              rate_bps INTEGER NOT NULL,
              is_default INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL,
              updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              product_type TEXT NOT NULL DEFAULT 'BASIC' CHECK(product_type IN ('BASIC','SERVICE')),
              name TEXT NOT NULL,
              category TEXT NOT NULL DEFAULT 'Alle',
              price INTEGER NOT NULL,
              tax_code_id TEXT NOT NULL DEFAULT 'tax_standard_ch',
              is_available INTEGER NOT NULL DEFAULT 1,
              station TEXT NOT NULL DEFAULT 'KITCHEN',
              created_at INTEGER NOT NULL,
              updated_at INTEGER,
              FOREIGN KEY(tax_code_id) REFERENCES tax_codes(id)
            );

            CREATE TABLE IF NOT EXISTS product_variant_groups (
              id TEXT PRIMARY KEY,
              applies_to TEXT NOT NULL DEFAULT 'PRODUCT' CHECK(applies_to IN ('PRODUCT','CATEGORY')),
              product_id TEXT,
              category TEXT,
              name TEXT NOT NULL,
              selection_type TEXT NOT NULL DEFAULT 'SINGLE' CHECK(selection_type IN ('SINGLE','MULTIPLE')),
              min_select INTEGER NOT NULL DEFAULT 0,
              max_select INTEGER NOT NULL DEFAULT 1,
              sort_order INTEGER NOT NULL DEFAULT 0,
              is_required INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL,
              updated_at INTEGER,
              CHECK(
                (applies_to = 'PRODUCT' AND product_id IS NOT NULL)
                OR (applies_to = 'CATEGORY' AND category IS NOT NULL)
              ),
              FOREIGN KEY(product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS product_variant_group_items (
              id TEXT PRIMARY KEY,
              variant_group_id TEXT NOT NULL,
              name TEXT NOT NULL,
              price_delta INTEGER NOT NULL DEFAULT 0 CHECK(price_delta >= 0),
              is_default INTEGER NOT NULL DEFAULT 0,
              sort_order INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL,
              updated_at INTEGER,
              FOREIGN KEY(variant_group_id) REFERENCES product_variant_groups(id)
            );

            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              order_number TEXT UNIQUE NOT NULL,
              status TEXT NOT NULL DEFAULT 'OPEN',
              subtotal INTEGER NOT NULL DEFAULT 0,
              tax_total INTEGER NOT NULL DEFAULT 0,
              total INTEGER NOT NULL DEFAULT 0,
              payment_status TEXT NOT NULL DEFAULT 'UNPAID',
              created_at INTEGER NOT NULL,
              updated_at INTEGER,
              closed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS order_items (
              id TEXT PRIMARY KEY,
              order_id TEXT NOT NULL,
              product_id TEXT,
              product_type TEXT NOT NULL DEFAULT 'BASIC',
              product_name TEXT NOT NULL,
              product_category TEXT NOT NULL DEFAULT '',
              quantity INTEGER NOT NULL,
              unit_price INTEGER NOT NULL,
              tax_code_id TEXT,
              tax_code_name TEXT NOT NULL DEFAULT '',
              tax_rate_bps INTEGER NOT NULL,
              tax_amount INTEGER NOT NULL,
              total_price INTEGER NOT NULL,
              station TEXT DEFAULT 'KITCHEN',
              notes TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS order_item_variant_snapshots (
              id TEXT PRIMARY KEY,
              order_item_id TEXT NOT NULL,
              variant_group_id TEXT,
              variant_group_name TEXT NOT NULL,
              variant_item_id TEXT,
              variant_item_name TEXT NOT NULL,
              price_delta INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(order_item_id) REFERENCES order_items(id)
            );

            CREATE TABLE IF NOT EXISTS payments (
              id TEXT PRIMARY KEY,
              order_id TEXT NOT NULL,
              amount INTEGER NOT NULL,
              method TEXT NOT NULL CHECK(method IN ('CASH','CARD_MANUAL','WALLEE')),
              status TEXT NOT NULL CHECK(status IN ('COMPLETED','FAILED','PENDING','CANCELED')),
              provider TEXT,
              provider_transaction_id TEXT,
              provider_status TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS cash_sessions (
              id TEXT PRIMARY KEY,
              opened_at INTEGER NOT NULL,
              closed_at INTEGER,
              opening_cash INTEGER NOT NULL DEFAULT 0,
              closing_cash_expected INTEGER,
              closing_cash_counted INTEGER,
              difference INTEGER,
              status TEXT NOT NULL DEFAULT 'OPEN'
            );

            CREATE TABLE IF NOT EXISTS cash_movements (
              id TEXT PRIMARY KEY,
              cash_session_id TEXT NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('OPENING','SALE','CASH_IN','CASH_OUT','CLOSING')),
              amount INTEGER NOT NULL,
              reason TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id)
            );

            CREATE TABLE IF NOT EXISTS print_jobs (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL CHECK(type IN ('RECEIPT','KITCHEN_SLIP','BAR_SLIP','DRAWER')),
              payload_json TEXT NOT NULL,
              station TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              error_message TEXT,
              created_at INTEGER NOT NULL,
              completed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS day_closes (
              id TEXT PRIMARY KEY,
              date TEXT NOT NULL UNIQUE,
              total_cash INTEGER NOT NULL,
              total_card INTEGER NOT NULL,
              order_count INTEGER NOT NULL,
              item_count INTEGER NOT NULL,
              report_json TEXT NOT NULL,
              created_at INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| format!("Could not migrate SQLite database: {error}"))?;

    add_column_if_missing(
        connection,
        "products",
        "product_type",
        "product_type TEXT NOT NULL DEFAULT 'BASIC'",
    )?;
    add_column_if_missing(
        connection,
        "products",
        "tax_code_id",
        "tax_code_id TEXT NOT NULL DEFAULT 'tax_standard_ch'",
    )?;
    add_column_if_missing(
        connection,
        "product_variant_groups",
        "applies_to",
        "applies_to TEXT NOT NULL DEFAULT 'PRODUCT'",
    )?;
    add_column_if_missing(
        connection,
        "product_variant_groups",
        "category",
        "category TEXT",
    )?;
    add_column_if_missing(
        connection,
        "order_items",
        "product_type",
        "product_type TEXT NOT NULL DEFAULT 'BASIC'",
    )?;
    add_column_if_missing(
        connection,
        "order_items",
        "product_category",
        "product_category TEXT NOT NULL DEFAULT ''",
    )?;
    add_column_if_missing(connection, "order_items", "tax_code_id", "tax_code_id TEXT")?;
    add_column_if_missing(
        connection,
        "order_items",
        "tax_code_name",
        "tax_code_name TEXT NOT NULL DEFAULT ''",
    )?;

    Ok(())
}

fn column_exists(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| format!("Could not inspect {table}: {error}"))?;

    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("Could not read {table} columns: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not parse {table} columns: {error}"))?;

    Ok(columns.iter().any(|existing| existing == column))
}

fn add_column_if_missing(
    connection: &Connection,
    table: &str,
    column: &str,
    column_definition: &str,
) -> Result<(), String> {
    if column_exists(connection, table, column)? {
        return Ok(());
    }

    // SQLite can add columns safely, but cannot retrofit all constraints on legacy tables.
    connection
        .execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column_definition}"),
            [],
        )
        .map_err(|error| format!("Could not add {table}.{column}: {error}"))?;

    Ok(())
}

fn seed_tax_codes(connection: &Connection) -> Result<usize, String> {
    let now = current_timestamp_ms();
    let mut upserted = 0;

    connection
        .execute(
            "UPDATE tax_codes SET is_default = 0 WHERE is_default = 1",
            [],
        )
        .map_err(|error| format!("Could not reset default tax code: {error}"))?;

    for tax_code in SEED_TAX_CODES {
        upserted += connection
            .execute(
                "
                INSERT INTO tax_codes (
                  id, code, name, rate_bps, is_default, is_active, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)
                ON CONFLICT(id) DO UPDATE SET
                  code = excluded.code,
                  name = excluded.name,
                  rate_bps = excluded.rate_bps,
                  is_default = excluded.is_default,
                  is_active = excluded.is_active,
                  updated_at = excluded.updated_at
                ",
                params![
                    tax_code.id,
                    tax_code.code,
                    tax_code.name,
                    tax_code.rate_bps,
                    tax_code.is_default as i64,
                    now
                ],
            )
            .map_err(|error| format!("Could not seed tax code {}: {error}", tax_code.id))?;
    }

    Ok(upserted)
}

fn seed_products(connection: &Connection) -> Result<usize, String> {
    let now = current_timestamp_ms();
    let mut upserted = 0;

    for product in SEED_PRODUCTS {
        upserted += connection
            .execute(
                "
                INSERT INTO products (
                  id, product_type, name, category, price, tax_code_id, station, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
                ON CONFLICT(id) DO UPDATE SET
                  product_type = excluded.product_type,
                  name = excluded.name,
                  category = excluded.category,
                  price = excluded.price,
                  tax_code_id = excluded.tax_code_id,
                  station = excluded.station,
                  updated_at = excluded.updated_at
                ",
                params![
                    product.id,
                    product.product_type,
                    product.name,
                    product.category,
                    product.price,
                    product.tax_code_id,
                    product.station,
                    now
                ],
            )
            .map_err(|error| format!("Could not seed product {}: {error}", product.id))?;
    }

    Ok(upserted)
}

fn seed_variant_groups(connection: &Connection) -> Result<usize, String> {
    let now = current_timestamp_ms();
    let mut upserted = 0;

    for group in SEED_VARIANT_GROUPS {
        upserted += connection
            .execute(
                "
                INSERT INTO product_variant_groups (
                  id, applies_to, product_id, category, name, selection_type, min_select, max_select,
                  sort_order, is_required, is_active, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11)
                ON CONFLICT(id) DO UPDATE SET
                  applies_to = excluded.applies_to,
                  product_id = excluded.product_id,
                  category = excluded.category,
                  name = excluded.name,
                  selection_type = excluded.selection_type,
                  min_select = excluded.min_select,
                  max_select = excluded.max_select,
                  sort_order = excluded.sort_order,
                  is_required = excluded.is_required,
                  is_active = excluded.is_active,
                  updated_at = excluded.updated_at
                ",
                params![
                    group.id,
                    group.applies_to,
                    group.product_id,
                    group.category,
                    group.name,
                    group.selection_type,
                    group.min_select,
                    group.max_select,
                    group.sort_order,
                    group.is_required as i64,
                    now
                ],
            )
            .map_err(|error| format!("Could not seed variant group {}: {error}", group.id))?;
    }

    Ok(upserted)
}

fn seed_variant_group_items(connection: &Connection) -> Result<usize, String> {
    let now = current_timestamp_ms();
    let mut upserted = 0;

    for group in SEED_VARIANT_GROUPS {
        connection
            .execute(
                "
                UPDATE product_variant_group_items
                SET is_default = 0
                WHERE variant_group_id = ?1
                ",
                params![group.id],
            )
            .map_err(|error| {
                format!(
                    "Could not reset default variant item for {}: {error}",
                    group.id
                )
            })?;
    }

    for item in SEED_VARIANT_GROUP_ITEMS {
        upserted += connection
            .execute(
                "
                INSERT INTO product_variant_group_items (
                  id, variant_group_id, name, price_delta, is_default,
                  sort_order, is_active, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)
                ON CONFLICT(id) DO UPDATE SET
                  variant_group_id = excluded.variant_group_id,
                  name = excluded.name,
                  price_delta = excluded.price_delta,
                  is_default = excluded.is_default,
                  sort_order = excluded.sort_order,
                  is_active = excluded.is_active,
                  updated_at = excluded.updated_at
                ",
                params![
                    item.id,
                    item.variant_group_id,
                    item.name,
                    item.price_delta,
                    item.is_default as i64,
                    item.sort_order,
                    now
                ],
            )
            .map_err(|error| format!("Could not seed variant group item {}: {error}", item.id))?;
    }

    Ok(upserted)
}

fn current_timestamp_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

#[tauri::command]
fn initialize_pos_database(app: AppHandle) -> Result<PosDatabaseInfo, String> {
    let connection = open_database(&app)?;
    migrate_database(&connection)?;
    let seeded_tax_codes = seed_tax_codes(&connection)?;
    let seeded_products = seed_products(&connection)?;
    let seeded_variant_groups = seed_variant_groups(&connection)?;
    let seeded_variant_group_items = seed_variant_group_items(&connection)?;
    let path = database_path(&app)?;

    Ok(PosDatabaseInfo {
        path: path.display().to_string(),
        seeded_tax_codes,
        seeded_products,
        seeded_variant_groups,
        seeded_variant_group_items,
    })
}

#[tauri::command]
fn list_products(app: AppHandle) -> Result<Vec<PosProduct>, String> {
    let connection = open_database(&app)?;
    migrate_database(&connection)?;
    seed_tax_codes(&connection)?;
    seed_products(&connection)?;
    seed_variant_groups(&connection)?;
    seed_variant_group_items(&connection)?;

    let mut statement = connection
        .prepare(
            "
            SELECT
              products.id,
              products.product_type,
              products.name,
              products.category,
              products.price,
              tax_codes.id,
              tax_codes.name,
              tax_codes.rate_bps,
              products.is_available,
              products.station
            FROM products
            INNER JOIN tax_codes ON tax_codes.id = products.tax_code_id
            WHERE products.is_available = 1
              AND tax_codes.is_active = 1
            ORDER BY products.category, products.name
            ",
        )
        .map_err(|error| format!("Could not prepare product query: {error}"))?;

    let products = statement
        .query_map([], |row| {
            Ok(PosProduct {
                id: row.get(0)?,
                product_type: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                price: row.get(4)?,
                tax_code_id: row.get(5)?,
                tax_code_name: row.get(6)?,
                tax_rate_bps: row.get(7)?,
                is_available: row.get::<_, i64>(8)? == 1,
                station: row.get(9)?,
            })
        })
        .map_err(|error| format!("Could not query products: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read product row: {error}"))?;

    Ok(products)
}

#[tauri::command]
fn list_product_variant_groups(
    app: AppHandle,
    product_id: String,
) -> Result<Vec<PosProductVariantGroup>, String> {
    let connection = open_database(&app)?;
    migrate_database(&connection)?;
    seed_tax_codes(&connection)?;
    seed_products(&connection)?;
    seed_variant_groups(&connection)?;
    seed_variant_group_items(&connection)?;

    let mut group_statement = connection
        .prepare(
            "
            SELECT
              product_variant_groups.id,
              product_variant_groups.applies_to,
              product_variant_groups.product_id,
              product_variant_groups.category,
              product_variant_groups.name,
              product_variant_groups.selection_type,
              product_variant_groups.min_select,
              product_variant_groups.max_select,
              product_variant_groups.sort_order,
              product_variant_groups.is_required
            FROM product_variant_groups
            INNER JOIN products ON products.id = ?1
            WHERE (
                (
                  product_variant_groups.applies_to = 'PRODUCT'
                  AND product_variant_groups.product_id = products.id
                )
                OR (
                  product_variant_groups.applies_to = 'CATEGORY'
                  AND product_variant_groups.category = products.category
                )
              )
              AND product_variant_groups.is_active = 1
              AND products.product_type = 'BASIC'
            ORDER BY product_variant_groups.sort_order, product_variant_groups.name
            ",
        )
        .map_err(|error| format!("Could not prepare variant group query: {error}"))?;

    let group_rows = group_statement
        .query_map(params![product_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)? == 1,
            ))
        })
        .map_err(|error| format!("Could not query variant groups: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read variant group row: {error}"))?;

    let mut groups = Vec::with_capacity(group_rows.len());

    for (
        id,
        applies_to,
        product_id,
        category,
        name,
        selection_type,
        min_select,
        max_select,
        sort_order,
        is_required,
    ) in group_rows
    {
        let items = list_variant_group_items(&connection, &id)?;

        groups.push(PosProductVariantGroup {
            id,
            applies_to,
            product_id,
            category,
            name,
            selection_type,
            min_select,
            max_select,
            sort_order,
            is_required,
            items,
        });
    }

    Ok(groups)
}

fn list_variant_group_items(
    connection: &Connection,
    variant_group_id: &str,
) -> Result<Vec<PosProductVariantGroupItem>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, variant_group_id, name, price_delta, is_default, sort_order
            FROM product_variant_group_items
            WHERE variant_group_id = ?1
              AND is_active = 1
            ORDER BY sort_order, name
            ",
        )
        .map_err(|error| format!("Could not prepare variant item query: {error}"))?;

    let items = statement
        .query_map(params![variant_group_id], |row| {
            Ok(PosProductVariantGroupItem {
                id: row.get(0)?,
                variant_group_id: row.get(1)?,
                name: row.get(2)?,
                price_delta: row.get(3)?,
                is_default: row.get::<_, i64>(4)? == 1,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|error| format!("Could not query variant items: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read variant item row: {error}"))?;

    Ok(items)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            initialize_pos_database,
            list_products,
            list_product_variant_groups
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
