import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  }

  return db;
}

function getSqliteClient() {
  if (sqlite) {
    return sqlite;
  }

  const dbPath = process.env.LOCAL_MASTER_DB_PATH ?? resolveLocalMasterPath("data", "local-master.sqlite3");
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

function migrateLocalMasterSchema(sqliteClient: Database.Database) {
  const categoryColumns = sqliteClient
    .prepare("PRAGMA table_info(catalog_categories)")
    .all() as Array<{ name: string }>;

  if (!categoryColumns.some((column) => column.name === "default_station_id")) {
    sqliteClient.prepare("ALTER TABLE catalog_categories ADD COLUMN default_station_id TEXT REFERENCES catalog_output_stations(id) ON DELETE SET NULL").run();
  }
}
