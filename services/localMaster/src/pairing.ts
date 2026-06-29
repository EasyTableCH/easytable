import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { getDatabase } from "./db.js";
import { loadPosSettings } from "./store.js";
import type {
  LocalMasterIdentity,
  PairTerminalRequest,
  PairingSession,
  PairingSessionRequest,
  TerminalHeartbeatRequest,
  TerminalPairingConfig,
  TerminalRecord
} from "./types.js";

const instanceStateKey = "localMaster.instanceId";
const pairingTtlMs = 5 * 60 * 1000;

export function getLocalMasterIdentity(): LocalMasterIdentity {
  const settings = loadPosSettings().settings;

  return {
    ok: true,
    service: "localMaster",
    instance_id: getOrCreateInstanceId(),
    location_id: settings.location_id,
    port: Number(process.env.LOCAL_MASTER_PORT ?? process.env.LOCAL_REALTIME_PORT ?? 3000),
    version: process.env.npm_package_version ?? "0.1.0"
  };
}

export function createPairingSession(request: PairingSessionRequest = {}): PairingSession {
  const db = getDatabase();
  const now = Date.now();
  const session: PairingSession = {
    code: createPairingCode(),
    expires_at: now + pairingTtlMs,
    instance_id: getOrCreateInstanceId(),
    local_master_url: normalizeOptionalUrl(request.local_master_url),
    location_id: loadPosSettings().settings.location_id
  };

  db.prepare(
    "INSERT INTO pairing_sessions (code, instance_id, display_url, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)"
  ).run(session.code, session.instance_id, session.local_master_url, session.expires_at, now);

  return session;
}

export function pairTerminal(request: PairTerminalRequest): TerminalPairingConfig {
  const terminalName = request.terminal_name.trim();
  const code = normalizePairingCode(request.code);
  const localMasterUrl = normalizeUrl(request.local_master_url);

  if (terminalName.length === 0) {
    throw new Error("Terminal name is required.");
  }

  const db = getDatabase();
  const now = Date.now();
  const session = db.prepare(
    "SELECT code, instance_id, display_url, expires_at, used_at FROM pairing_sessions WHERE code = ?"
  ).get(code) as PairingSessionRow | undefined;

  if (!session || session.used_at !== null || session.expires_at < now) {
    throw new Error("Pairing code is invalid or expired.");
  }

  const terminalId = "term_" + randomUUID();
  const terminalSecret = randomBytes(24).toString("hex");
  const role = request.role ?? "POS_TERMINAL";

  db.prepare(
    "INSERT INTO paired_terminals (id, instance_id, name, role, secret, device_fingerprint, paired_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    terminalId,
    session.instance_id,
    terminalName,
    role,
    terminalSecret,
    request.device_fingerprint ?? null,
    now,
    now
  );
  db.prepare("UPDATE pairing_sessions SET used_at = ? WHERE code = ?").run(now, code);

  return {
    localMasterUrl,
    localMasterInstanceId: session.instance_id,
    terminalId,
    terminalName,
    terminalRole: role,
    terminalSecret,
    pairedAt: now,
    lastSeenAt: now
  };
}

export function recordTerminalHeartbeat(
  terminalId: string,
  request: TerminalHeartbeatRequest
): TerminalRecord {
  const db = getDatabase();
  const terminal = db.prepare(
    "SELECT id, instance_id, name, role, secret, device_fingerprint, paired_at, last_seen_at FROM paired_terminals WHERE id = ?"
  ).get(terminalId) as TerminalRow | undefined;

  if (!terminal || terminal.secret !== request.terminal_secret) {
    throw new Error("Unknown terminal or invalid terminal secret.");
  }

  const now = Date.now();
  db.prepare("UPDATE paired_terminals SET last_seen_at = ? WHERE id = ?").run(now, terminalId);

  return {
    id: terminal.id,
    instance_id: terminal.instance_id,
    name: terminal.name,
    role: terminal.role,
    device_fingerprint: terminal.device_fingerprint,
    paired_at: terminal.paired_at,
    last_seen_at: now
  };
}

function getOrCreateInstanceId() {
  const db = getDatabase();
  const row = db.prepare("SELECT value_json FROM local_state WHERE key = ?").get(instanceStateKey) as
    | { value_json: string }
    | undefined;

  if (row) {
    return JSON.parse(row.value_json) as string;
  }

  const instanceId = "lm_" + randomUUID();
  db.prepare("INSERT INTO local_state (key, value_json, updated_at) VALUES (?, ?, ?)").run(
    instanceStateKey,
    JSON.stringify(instanceId),
    Date.now()
  );

  return instanceId;
}

function createPairingCode() {
  const db = getDatabase();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const existing = db.prepare("SELECT code FROM pairing_sessions WHERE code = ? AND used_at IS NULL").get(code);

    if (!existing) {
      return code;
    }
  }

  return String(randomInt(0, 10_000_000)).padStart(7, "0");
}

function normalizePairingCode(code: string) {
  return code.replace(/\s/g, "").trim();
}

function normalizeOptionalUrl(url: string | undefined) {
  if (!url || url.trim().length === 0) {
    return null;
  }

  return normalizeUrl(url);
}

function normalizeUrl(url: string) {
  const parsed = new URL(url.trim());

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("LocalMaster URL must use http or https.");
  }

  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
}

type PairingSessionRow = {
  code: string;
  instance_id: string;
  display_url: string | null;
  expires_at: number;
  used_at: number | null;
};

type TerminalRow = {
  id: string;
  instance_id: string;
  name: string;
  role: string;
  secret: string;
  device_fingerprint: string | null;
  paired_at: number;
  last_seen_at: number;
};