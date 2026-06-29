import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | null = null;

export function getDatabase() {
  if (database) {
    return database;
  }

  const dbPath = process.env.LOCAL_MASTER_DB_PATH ?? resolve(process.cwd(), "data", "local-master.sqlite3");
  mkdirSync(dirname(dbPath), { recursive: true });

  database = new DatabaseSync(dbPath);
  configureDatabase(database);
  ensureSchema(database);

  return database;
}

function configureDatabase(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
}

function ensureSchema(db: DatabaseSync) {
  db.exec([
    "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, tenant_id TEXT NOT NULL, location_id TEXT NOT NULL, floor_id TEXT NOT NULL, area_id TEXT NOT NULL, table_id TEXT, table_name TEXT, service_mode TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, subtotal INTEGER NOT NULL, tax_total INTEGER NOT NULL, total INTEGER NOT NULL, payment_status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, closed_at INTEGER)",
    "CREATE INDEX IF NOT EXISTS idx_orders_open_table ON orders(table_id, service_mode, status, payment_status, created_at)",
    "CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT, product_type TEXT NOT NULL, product_name TEXT NOT NULL, product_category TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, tax_code_id TEXT, tax_code_name TEXT NOT NULL, tax_rate_bps INTEGER NOT NULL, tax_amount INTEGER NOT NULL, total_price INTEGER NOT NULL, station TEXT, notes TEXT, created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id, created_at)",
    "CREATE TABLE IF NOT EXISTS order_item_variant_snapshots (id TEXT PRIMARY KEY, order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE, variant_group_id TEXT, variant_group_name TEXT NOT NULL, variant_item_id TEXT, variant_item_name TEXT NOT NULL, price_delta INTEGER NOT NULL, created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_order_item_variants_item ON order_item_variant_snapshots(order_item_id, created_at)",
    "CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, amount INTEGER NOT NULL, received_cash INTEGER, change_given INTEGER, method TEXT NOT NULL, status TEXT NOT NULL, provider TEXT NOT NULL, provider_transaction_id TEXT, provider_status TEXT NOT NULL, created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_payments_day_close ON payments(status, method, created_at)",
    "CREATE TABLE IF NOT EXISTS day_closes (id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, total_cash INTEGER NOT NULL, total_card INTEGER NOT NULL, order_count INTEGER NOT NULL, item_count INTEGER NOT NULL, report_json TEXT NOT NULL, created_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS local_state (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS pairing_sessions (code TEXT PRIMARY KEY, instance_id TEXT NOT NULL, display_url TEXT, expires_at INTEGER NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_pairing_sessions_expires ON pairing_sessions(expires_at, used_at)",
    "CREATE TABLE IF NOT EXISTS paired_terminals (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, secret TEXT NOT NULL, device_fingerprint TEXT, paired_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_paired_terminals_seen ON paired_terminals(last_seen_at)"
  ].join(";"));
}
