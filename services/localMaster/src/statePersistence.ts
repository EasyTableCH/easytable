import { getDatabase } from "./db.js";

type StateRow = {
  value_json: string;
};

export function readState<T>(key: string, fallback: T): T {
  const row = getDatabase()
    .prepare("SELECT value_json FROM local_state WHERE key = ?")
    .get(key) as StateRow | undefined;

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return fallback;
  }
}

export function writeState(key: string, value: unknown) {
  getDatabase()
    .prepare("INSERT INTO local_state (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at")
    .run(key, JSON.stringify(value), Date.now());
}
