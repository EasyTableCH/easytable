import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema.js";

let sqlite: Database.Database | null = null;
let db: BetterSQLite3Database<typeof schema> | null = null;

export function getDrizzleDatabase() {
  if (!db) {
    const sqliteClient = getSqliteClient();
    db = drizzle(sqliteClient, { schema });
    migrate(db, { migrationsFolder: resolveLocalMasterPath("drizzle") });
    migrateLocalMasterSchema(sqliteClient);

    if (process.env.LOCAL_MASTER_DISABLE_POWERSYNC !== "1") {
      const dbPath = resolveDatabasePath(process.env.LOCAL_MASTER_DB_PATH);
      void startPowerSyncSafely(dbPath);
    }
  }

  return db;
}

async function startPowerSyncSafely(dbPath: string) {
  try {
    const { startPowerSync } = await import("../lib/powersync.js");
    await startPowerSync(dbPath);
  } catch (error) {
    console.warn("PowerSync startup skipped or failed:", error);
  }
}

function getSqliteClient() {
  if (sqlite) {
    return sqlite;
  }

  const dbPath = resolveDatabasePath(process.env.LOCAL_MASTER_DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  return sqlite;
}

function resolveLocalMasterPath(...segments: string[]) {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ...segments);
}

function resolveRepositoryPath(...segments: string[]) {
  return resolveLocalMasterPath("..", "..", ...segments);
}

function resolveDatabasePath(configuredPath: string | undefined) {
  if (!configuredPath) {
    return resolveLocalMasterPath("data", "local-master.sqlite3");
  }

  if (isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const normalizedPath = configuredPath.replace(/\\/g, "/");
  if (normalizedPath === "services/localMaster" || normalizedPath.startsWith("services/localMaster/")) {
    return resolveRepositoryPath(normalizedPath);
  }

  return resolveLocalMasterPath(configuredPath);
}

function migrateLocalMasterSchema(sqliteClient: Database.Database) {
  sqliteClient
    .prepare(
      `CREATE TABLE IF NOT EXISTS layout_floors (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  sqliteClient
    .prepare("CREATE INDEX IF NOT EXISTS idx_layout_floors_location ON layout_floors(location_id, sort_order, name)")
    .run();
  sqliteClient
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_floors_location_name ON layout_floors(location_id, name)")
    .run();

  sqliteClient
    .prepare(
      `CREATE TABLE IF NOT EXISTS layout_areas (
        id TEXT PRIMARY KEY,
        floor_id TEXT NOT NULL REFERENCES layout_floors(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  sqliteClient
    .prepare("CREATE INDEX IF NOT EXISTS idx_layout_areas_floor ON layout_areas(floor_id, sort_order, name)")
    .run();
  sqliteClient
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_areas_floor_name ON layout_areas(floor_id, name)")
    .run();

  sqliteClient
    .prepare(
      `CREATE TABLE IF NOT EXISTS layout_tables (
        id TEXT PRIMARY KEY,
        area_id TEXT NOT NULL REFERENCES layout_areas(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        seats INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  sqliteClient
    .prepare("CREATE INDEX IF NOT EXISTS idx_layout_tables_area ON layout_tables(area_id, sort_order, name)")
    .run();
  sqliteClient
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_tables_area_name ON layout_tables(area_id, name)")
    .run();

  const categoryColumns = sqliteClient
    .prepare("PRAGMA table_info(catalog_categories)")
    .all() as Array<{ name: string }>;

  if (!categoryColumns.some((column) => column.name === "default_station_id")) {
    sqliteClient.prepare("ALTER TABLE catalog_categories ADD COLUMN default_station_id TEXT REFERENCES catalog_output_stations(id) ON DELETE SET NULL").run();
  }

  const stationColumns = sqliteClient
    .prepare("PRAGMA table_info(catalog_output_stations)")
    .all() as Array<{ name: string }>;

  if (!stationColumns.some((column) => column.name === "has_kds")) {
    sqliteClient.prepare("ALTER TABLE catalog_output_stations ADD COLUMN has_kds INTEGER NOT NULL DEFAULT 0").run();
  }

  if (!stationColumns.some((column) => column.name === "has_printer")) {
    sqliteClient.prepare("ALTER TABLE catalog_output_stations ADD COLUMN has_printer INTEGER NOT NULL DEFAULT 0").run();
  }

  sqliteClient
    .prepare(
      "UPDATE catalog_output_stations SET has_kds = 1 WHERE kind IN ('KDS', 'KDS_AND_PRINTER') AND has_kds = 0"
    )
    .run();
  sqliteClient
    .prepare(
      "UPDATE catalog_output_stations SET has_printer = 1 WHERE kind IN ('PRINTER', 'KDS_AND_PRINTER') AND has_printer = 0"
    )
    .run();

  migrateFinancialTables(sqliteClient);
  backfillFinancialTablesFromLocalState(sqliteClient);
}

function migrateFinancialTables(sqliteClient: Database.Database) {
  sqliteClient.prepare(`CREATE TABLE IF NOT EXISTS order_snapshots (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    snapshot_type TEXT NOT NULL,
    table_context_json TEXT,
    subtotal INTEGER NOT NULL,
    tax_total INTEGER NOT NULL,
    total INTEGER NOT NULL,
    payment_id TEXT NOT NULL,
    payment_request_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_amount INTEGER NOT NULL,
    payment_terminal_id TEXT,
    provider TEXT NOT NULL,
    provider_transaction_id TEXT,
    provider_status TEXT NOT NULL,
    payment_lifecycle_state TEXT NOT NULL,
    paid_at INTEGER NOT NULL,
    terminal_id TEXT,
    business_date TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  sqliteClient.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_order_snapshots_order ON order_snapshots(order_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_order_snapshots_business_date ON order_snapshots(business_date, created_at)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_order_snapshots_payment ON order_snapshots(payment_method, payment_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_order_snapshots_terminal ON order_snapshots(terminal_id)").run();

  sqliteClient.prepare(`CREATE TABLE IF NOT EXISTS order_snapshot_lines (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES order_snapshots(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_type TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_category TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    tax_code_id TEXT NOT NULL,
    tax_code_name TEXT NOT NULL,
    tax_rate_bps INTEGER NOT NULL,
    station TEXT NOT NULL,
    variants_json TEXT NOT NULL,
    unit_total INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    line_total INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  sqliteClient.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_order_snapshot_lines_snapshot_line ON order_snapshot_lines(snapshot_id, line_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_order_snapshot_lines_order ON order_snapshot_lines(order_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_order_snapshot_lines_product ON order_snapshot_lines(product_id, product_name)").run();

  sqliteClient.prepare(`CREATE TABLE IF NOT EXISTS sales_ledger_entries (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    payment_id TEXT,
    original_entry_id TEXT,
    line_id TEXT,
    product_id TEXT,
    product_name TEXT,
    product_category TEXT,
    quantity INTEGER NOT NULL,
    gross_amount INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL,
    payment_method TEXT,
    terminal_id TEXT,
    provider TEXT,
    provider_transaction_id TEXT,
    provider_refund_id TEXT,
    provider_status TEXT,
    reason TEXT,
    business_date TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
  )`).run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_sales_ledger_business_date ON sales_ledger_entries(business_date, occurred_at)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_sales_ledger_order ON sales_ledger_entries(order_id, entry_type)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_sales_ledger_payment ON sales_ledger_entries(payment_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_sales_ledger_method ON sales_ledger_entries(payment_method, business_date)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_sales_ledger_terminal ON sales_ledger_entries(terminal_id, business_date)").run();

  sqliteClient.prepare(`CREATE TABLE IF NOT EXISTS local_outbox (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    synced_at INTEGER,
    sync_attempt_count INTEGER NOT NULL DEFAULT 0,
    last_sync_error TEXT
  )`).run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_local_outbox_pending ON local_outbox(synced_at, created_at)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_local_outbox_aggregate ON local_outbox(aggregate_id, created_at)").run();

  sqliteClient.prepare(`CREATE TABLE IF NOT EXISTS command_inbox (
    id TEXT PRIMARY KEY,
    command_type TEXT NOT NULL,
    request_id TEXT NOT NULL,
    payload_fingerprint TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  )`).run();
  sqliteClient.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_command_inbox_command_request ON command_inbox(command_type, request_id)").run();
  sqliteClient.prepare("CREATE INDEX IF NOT EXISTS idx_command_inbox_status ON command_inbox(status, updated_at)").run();
}

function backfillFinancialTablesFromLocalState(sqliteClient: Database.Database) {
  const snapshots = readLegacyStateArray(sqliteClient, "orderSnapshots");
  const insertSnapshot = sqliteClient.prepare(`INSERT OR IGNORE INTO order_snapshots (
    id, order_id, order_number, snapshot_type, table_context_json, subtotal, tax_total, total,
    payment_id, payment_request_id, payment_method, payment_amount, payment_terminal_id,
    provider, provider_transaction_id, provider_status, payment_lifecycle_state, paid_at,
    terminal_id, business_date, created_at
  ) VALUES (
    @id, @order_id, @order_number, @snapshot_type, @table_context_json, @subtotal, @tax_total, @total,
    @payment_id, @payment_request_id, @payment_method, @payment_amount, @payment_terminal_id,
    @provider, @provider_transaction_id, @provider_status, @payment_lifecycle_state, @paid_at,
    @terminal_id, @business_date, @created_at
  )`);
  const insertLine = sqliteClient.prepare(`INSERT OR IGNORE INTO order_snapshot_lines (
    id, snapshot_id, order_id, line_id, product_id, product_type, product_name, product_category,
    base_price, tax_code_id, tax_code_name, tax_rate_bps, station, variants_json,
    unit_total, quantity, line_total, created_at
  ) VALUES (
    @id, @snapshot_id, @order_id, @line_id, @product_id, @product_type, @product_name, @product_category,
    @base_price, @tax_code_id, @tax_code_name, @tax_rate_bps, @station, @variants_json,
    @unit_total, @quantity, @line_total, @created_at
  )`);

  const insertSnapshotTx = sqliteClient.transaction((items: any[]) => {
    for (const snapshot of items) {
      if (!snapshot?.id || !snapshot?.order_id || !snapshot?.payment) continue;
      insertSnapshot.run({
        id: snapshot.id,
        order_id: snapshot.order_id,
        order_number: snapshot.order_number ?? "",
        snapshot_type: snapshot.snapshot_type ?? "PAID",
        table_context_json: snapshot.table_context ? JSON.stringify(snapshot.table_context) : null,
        subtotal: integerOrZero(snapshot.subtotal),
        tax_total: integerOrZero(snapshot.tax_total),
        total: integerOrZero(snapshot.total),
        payment_id: snapshot.payment.payment_id ?? "",
        payment_request_id: snapshot.payment.request_id ?? "",
        payment_method: snapshot.payment.method ?? "",
        payment_amount: integerOrZero(snapshot.payment.amount),
        payment_terminal_id: snapshot.payment.terminal_id ?? null,
        provider: snapshot.payment.provider ?? "",
        provider_transaction_id: snapshot.payment.provider_transaction_id ?? null,
        provider_status: snapshot.payment.provider_status ?? "",
        payment_lifecycle_state: snapshot.payment.lifecycle_state ?? "",
        paid_at: integerOrZero(snapshot.payment.paid_at),
        terminal_id: snapshot.terminal_id ?? null,
        business_date: snapshot.business_date ?? "",
        created_at: integerOrZero(snapshot.created_at)
      });
      for (const line of Array.isArray(snapshot.lines) ? snapshot.lines : []) {
        if (!line?.id) continue;
        insertLine.run({
          id: snapshot.id + ":" + line.id,
          snapshot_id: snapshot.id,
          order_id: snapshot.order_id,
          line_id: line.id,
          product_id: line.product_id ?? "",
          product_type: line.product_type ?? "BASIC",
          product_name: line.product_name ?? "",
          product_category: line.product_category ?? "",
          base_price: integerOrZero(line.base_price),
          tax_code_id: line.tax_code_id ?? "",
          tax_code_name: line.tax_code_name ?? "",
          tax_rate_bps: integerOrZero(line.tax_rate_bps),
          station: line.station ?? "",
          variants_json: JSON.stringify(Array.isArray(line.variants) ? line.variants : []),
          unit_total: integerOrZero(line.unit_total),
          quantity: integerOrZero(line.quantity),
          line_total: integerOrZero(line.line_total),
          created_at: integerOrZero(snapshot.created_at)
        });
      }
    }
  });
  insertSnapshotTx(snapshots);

  const ledgerEntries = readLegacyStateArray(sqliteClient, "salesLedgerEntries");
  const insertLedger = sqliteClient.prepare(`INSERT OR IGNORE INTO sales_ledger_entries (
    id, request_id, entry_type, order_id, order_number, payment_id, original_entry_id, line_id,
    product_id, product_name, product_category, quantity, gross_amount, tax_amount, payment_method,
    terminal_id, provider, provider_transaction_id, provider_refund_id, provider_status, reason,
    business_date, occurred_at
  ) VALUES (
    @id, @request_id, @entry_type, @order_id, @order_number, @payment_id, @original_entry_id, @line_id,
    @product_id, @product_name, @product_category, @quantity, @gross_amount, @tax_amount, @payment_method,
    @terminal_id, @provider, @provider_transaction_id, @provider_refund_id, @provider_status, @reason,
    @business_date, @occurred_at
  )`);
  const insertLedgerTx = sqliteClient.transaction((items: any[]) => {
    for (const entry of items) {
      if (!entry?.id || !entry?.order_id) continue;
      insertLedger.run({
        id: entry.id,
        request_id: entry.request_id ?? "",
        entry_type: entry.entry_type ?? "",
        order_id: entry.order_id,
        order_number: entry.order_number ?? "",
        payment_id: entry.payment_id ?? null,
        original_entry_id: entry.original_entry_id ?? null,
        line_id: entry.line_id ?? null,
        product_id: entry.product_id ?? null,
        product_name: entry.product_name ?? null,
        product_category: entry.product_category ?? null,
        quantity: integerOrZero(entry.quantity),
        gross_amount: integerOrZero(entry.gross_amount),
        tax_amount: integerOrZero(entry.tax_amount),
        payment_method: entry.payment_method ?? null,
        terminal_id: entry.terminal_id ?? null,
        provider: entry.provider ?? null,
        provider_transaction_id: entry.provider_transaction_id ?? null,
        provider_refund_id: entry.provider_refund_id ?? null,
        provider_status: entry.provider_status ?? null,
        reason: entry.reason ?? null,
        business_date: entry.business_date ?? "",
        occurred_at: integerOrZero(entry.occurred_at)
      });
    }
  });
  insertLedgerTx(ledgerEntries);

  backfillOutbox(sqliteClient);
  backfillCommandInbox(sqliteClient);
}

function backfillOutbox(sqliteClient: Database.Database) {
  const events = readLegacyStateArray(sqliteClient, "localOutbox");
  const insert = sqliteClient.prepare(`INSERT OR IGNORE INTO local_outbox (
    id, event_type, aggregate_id, payload_json, created_at, synced_at, sync_attempt_count, last_sync_error
  ) VALUES (@id, @event_type, @aggregate_id, @payload_json, @created_at, NULL, 0, NULL)`);
  const tx = sqliteClient.transaction((items: any[]) => {
    for (const event of items) {
      if (!event?.id) continue;
      insert.run({
        id: event.id,
        event_type: event.event_type ?? "",
        aggregate_id: event.aggregate_id ?? "",
        payload_json: JSON.stringify(event.payload ?? null),
        created_at: integerOrZero(event.created_at)
      });
    }
  });
  tx(events);
}

function backfillCommandInbox(sqliteClient: Database.Database) {
  const entries = readLegacyStateArray(sqliteClient, "commandInbox");
  const insert = sqliteClient.prepare(`INSERT OR IGNORE INTO command_inbox (
    id, command_type, request_id, payload_fingerprint, status, result_json, error, created_at, updated_at, completed_at
  ) VALUES (
    @id, @command_type, @request_id, @payload_fingerprint, @status, @result_json, @error, @created_at, @updated_at, @completed_at
  )`);
  const tx = sqliteClient.transaction((items: any[]) => {
    for (const entry of items) {
      if (!entry?.id) continue;
      insert.run({
        id: entry.id,
        command_type: entry.command_type ?? "",
        request_id: entry.request_id ?? "",
        payload_fingerprint: entry.payload_fingerprint ?? "",
        status: entry.status ?? "FAILED",
        result_json: entry.result === undefined ? null : JSON.stringify(entry.result),
        error: entry.error ?? null,
        created_at: integerOrZero(entry.created_at),
        updated_at: integerOrZero(entry.updated_at),
        completed_at: entry.completed_at ?? null
      });
    }
  });
  tx(entries);
}

function readLegacyStateArray(sqliteClient: Database.Database, key: string): any[] {
  const row = sqliteClient.prepare("SELECT value_json FROM local_state WHERE key = ?").get(key) as { value_json?: string } | undefined;
  if (!row?.value_json) return [];
  try {
    const parsed = JSON.parse(row.value_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function integerOrZero(value: unknown) {
  return Number.isInteger(value) ? value as number : 0;
}
