import { createHash } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import { commandInbox as commandInboxTable, localOutbox as localOutboxTable } from "../db/schema.js";
import { readState, writeState } from "../statePersistence.js";
import { scopedId } from "./storeHelpers.js";

export type CommandStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type CommandInboxEntry = {
  id: string;
  command_type: string;
  request_id: string;
  payload_fingerprint: string;
  status: CommandStatus;
  result: unknown;
  error: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

export type LocalOutboxEvent = {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: unknown;
  created_at: number;
  synced_at?: number | null;
  sync_attempt_count?: number;
  last_sync_error?: string | null;
};

export type IdempotentCommandHandle =
  | { mode: "execute"; entry: CommandInboxEntry }
  | { mode: "replay"; entry: CommandInboxEntry; result: unknown };

const commandInbox = readState<CommandInboxEntry[]>("commandInbox", []);
const localOutbox = readState<LocalOutboxEvent[]>("localOutbox", []);

export function beginIdempotentCommand(
  commandType: string,
  requestId: string,
  payload: unknown
): IdempotentCommandHandle {
  const normalizedRequestId = requestId.trim();

  if (!normalizedRequestId) {
    throw new Error("Command request_id is required.");
  }

  const payloadFingerprint = fingerprintPayload(payload);
  const existing = getCommandEntry(commandType, normalizedRequestId);

  if (existing) {
    if (existing.payload_fingerprint !== payloadFingerprint) {
      throw new Error("Command request_id was already used with a different payload.");
    }

    if (existing.status === "COMPLETED") {
      return { mode: "replay", entry: existing, result: existing.result };
    }

    if (existing.status === "FAILED") {
      throw new Error(existing.error ?? "Command previously failed.");
    }

    throw new Error("Command is already in progress.");
  }

  const now = Date.now();
  const entry: CommandInboxEntry = {
    id: scopedId("cmd", now, commandInbox.length),
    command_type: commandType,
    request_id: normalizedRequestId,
    payload_fingerprint: payloadFingerprint,
    status: "IN_PROGRESS",
    result: null,
    error: null,
    created_at: now,
    updated_at: now,
    completed_at: null
  };

  insertCommandEntry(entry);

  return { mode: "execute", entry };
}

export function completeIdempotentCommand<T>(entry: CommandInboxEntry, result: T): T {
  const now = Date.now();

  entry.status = "COMPLETED";
  entry.result = result;
  entry.error = null;
  entry.updated_at = now;
  entry.completed_at = now;
  updateCommandEntry(entry);

  return result;
}

export function failIdempotentCommand(entry: CommandInboxEntry, error: unknown): never {
  const now = Date.now();

  entry.status = "FAILED";
  entry.error = error instanceof Error ? error.message : String(error);
  entry.updated_at = now;
  entry.completed_at = now;
  updateCommandEntry(entry);

  throw error;
}

export function appendOutboxEvent(eventType: string, aggregateId: string, payload: unknown): LocalOutboxEvent {
  const now = Date.now();
  const event: LocalOutboxEvent = {
    id: scopedId("evt", now, countOutboxEvents()),
    event_type: eventType,
    aggregate_id: aggregateId,
    payload,
    created_at: now,
    synced_at: null,
    sync_attempt_count: 0,
    last_sync_error: null
  };

  insertOutboxEvent(event);
  mirrorLocalOutbox(event);

  return event;
}

export function listPendingOutboxEvents(limit = 100): LocalOutboxEvent[] {
  const rows = getDrizzleDatabase()
    .select()
    .from(localOutboxTable)
    .where(isNull(localOutboxTable.syncedAt))
    .orderBy(asc(localOutboxTable.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    event_type: row.eventType,
    aggregate_id: row.aggregateId,
    payload: parseJson(row.payloadJson),
    created_at: row.createdAt,
    synced_at: row.syncedAt,
    sync_attempt_count: row.syncAttemptCount,
    last_sync_error: row.lastSyncError
  }));
}

export function markOutboxEventsSynced(eventIds: string[], syncedAt = Date.now()) {
  for (const eventId of eventIds) {
    getDrizzleDatabase()
      .update(localOutboxTable)
      .set({ syncedAt, lastSyncError: null })
      .where(eq(localOutboxTable.id, eventId))
      .run();
  }
}

export function markOutboxEventsFailed(eventIds: string[], error: string) {
  for (const eventId of eventIds) {
    const row = getDrizzleDatabase()
      .select({ count: localOutboxTable.syncAttemptCount })
      .from(localOutboxTable)
      .where(eq(localOutboxTable.id, eventId))
      .get();
    getDrizzleDatabase()
      .update(localOutboxTable)
      .set({ syncAttemptCount: (row?.count ?? 0) + 1, lastSyncError: error })
      .where(eq(localOutboxTable.id, eventId))
      .run();
  }
}

function getCommandEntry(commandType: string, requestId: string) {
  const row = getDrizzleDatabase()
    .select()
    .from(commandInboxTable)
    .where(and(eq(commandInboxTable.commandType, commandType), eq(commandInboxTable.requestId, requestId)))
    .get();

  return row ? toCommandInboxEntry(row) : null;
}

function insertCommandEntry(entry: CommandInboxEntry) {
  getDrizzleDatabase()
    .insert(commandInboxTable)
    .values({
      id: entry.id,
      commandType: entry.command_type,
      requestId: entry.request_id,
      payloadFingerprint: entry.payload_fingerprint,
      status: entry.status,
      resultJson: JSON.stringify(entry.result),
      error: entry.error,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      completedAt: entry.completed_at
    })
    .onConflictDoNothing()
    .run();
  commandInbox.push(entry);
  writeState("commandInbox", commandInbox);
}

function updateCommandEntry(entry: CommandInboxEntry) {
  getDrizzleDatabase()
    .update(commandInboxTable)
    .set({
      status: entry.status,
      resultJson: JSON.stringify(entry.result),
      error: entry.error,
      updatedAt: entry.updated_at,
      completedAt: entry.completed_at
    })
    .where(eq(commandInboxTable.id, entry.id))
    .run();
  const existingIndex = commandInbox.findIndex((candidate) => candidate.id === entry.id);
  if (existingIndex >= 0) {
    commandInbox[existingIndex] = entry;
  } else {
    commandInbox.push(entry);
  }
  writeState("commandInbox", commandInbox);
}

function toCommandInboxEntry(row: typeof commandInboxTable.$inferSelect): CommandInboxEntry {
  return {
    id: row.id,
    command_type: row.commandType,
    request_id: row.requestId,
    payload_fingerprint: row.payloadFingerprint,
    status: row.status as CommandStatus,
    result: row.resultJson ? parseJson(row.resultJson) : null,
    error: row.error,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    completed_at: row.completedAt
  };
}

function insertOutboxEvent(event: LocalOutboxEvent) {
  getDrizzleDatabase()
    .insert(localOutboxTable)
    .values({
      id: event.id,
      eventType: event.event_type,
      aggregateId: event.aggregate_id,
      payloadJson: JSON.stringify(event.payload),
      createdAt: event.created_at,
      syncedAt: event.synced_at ?? null,
      syncAttemptCount: event.sync_attempt_count ?? 0,
      lastSyncError: event.last_sync_error ?? null
    })
    .onConflictDoNothing()
    .run();
}

function mirrorLocalOutbox(event: LocalOutboxEvent) {
  localOutbox.push(event);
  writeState("localOutbox", localOutbox);
}

function countOutboxEvents() {
  const row = getDrizzleDatabase()
    .select({ id: localOutboxTable.id })
    .from(localOutboxTable)
    .orderBy(asc(localOutboxTable.createdAt))
    .all();
  return row.length;
}

function fingerprintPayload(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "__undefined";
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
  }

  return "{" + Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => JSON.stringify(key) + ":" + stableStringify(item))
    .join(",") + "}";
}
