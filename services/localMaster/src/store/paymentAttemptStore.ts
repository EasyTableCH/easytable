import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray, lte } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import { paymentAttempts, paymentEvents, paymentReceipts, paymentRecoveryJobs } from "../db/schema.js";
import type { PaymentLifecycleState, StartWalleeTerminalPaymentRequest } from "../types.js";

export type PaymentAttemptRecord = typeof paymentAttempts.$inferSelect;

export function beginPaymentAttempt(request: StartWalleeTerminalPaymentRequest, amount: number) {
  const requestId = request.request_id.trim();
  const requestPayload = {
    lines: request.lines,
    table_context: request.table_context,
    wallee_terminal_config_id: request.wallee_terminal_config_id ?? null
  };
  const payloadFingerprint = createHash("sha256").update(stableStringify(requestPayload)).digest("hex");
  const existing = getPaymentAttemptByRequestId(requestId);
  if (existing) {
    if (existing.payloadFingerprint !== payloadFingerprint) throw new Error("Payment request_id was already used with a different payload.");
    return { mode: "replay" as const, attempt: existing };
  }

  const now = Date.now();
  const id = "payment_attempt_" + randomUUID();
  const merchantReference = "easytable-" + requestId;
  getDrizzleDatabase().insert(paymentAttempts).values({
    id,
    requestId,
    payloadFingerprint,
    orderId: null,
    paymentId: null,
    amount,
    currency: "CHF",
    method: "WALLEE_TERMINAL",
    walleeTerminalConfigId: request.wallee_terminal_config_id ?? null,
    merchantReference,
    providerTransactionId: null,
    providerState: null,
    lifecycleState: "payment_started",
    reconciliationRequired: 0,
    failureReason: null,
    requestJson: JSON.stringify(request),
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }).run();
  recordPaymentEvent(id, "PAYMENT_STARTED", null, { request_id: requestId, amount });
  return { mode: "execute" as const, attempt: getPaymentAttempt(id)! };
}

export function getPaymentAttempt(id: string) {
  return getDrizzleDatabase().select().from(paymentAttempts).where(eq(paymentAttempts.id, id)).get() ?? null;
}

export function getPaymentAttemptByRequestId(requestId: string) {
  return getDrizzleDatabase().select().from(paymentAttempts).where(eq(paymentAttempts.requestId, requestId)).get() ?? null;
}

export function getPaymentAttemptByProviderTransactionId(transactionId: string) {
  return getDrizzleDatabase().select().from(paymentAttempts).where(eq(paymentAttempts.providerTransactionId, transactionId)).get() ?? null;
}

export function getPaymentAttemptByPaymentId(paymentId: string) {
  return getDrizzleDatabase().select().from(paymentAttempts).where(eq(paymentAttempts.paymentId, paymentId)).get() ?? null;
}

export function updatePaymentAttempt(
  id: string,
  patch: Partial<{
    orderId: string | null;
    paymentId: string | null;
    providerTransactionId: string | null;
    providerState: string | null;
    lifecycleState: PaymentLifecycleState;
    reconciliationRequired: boolean;
    failureReason: string | null;
    completedAt: number | null;
  }>
) {
  const values: Record<string, unknown> = { updatedAt: Date.now() };
  if ("orderId" in patch) values.orderId = patch.orderId;
  if ("paymentId" in patch) values.paymentId = patch.paymentId;
  if ("providerTransactionId" in patch) values.providerTransactionId = patch.providerTransactionId;
  if ("providerState" in patch) values.providerState = patch.providerState;
  if ("lifecycleState" in patch) values.lifecycleState = patch.lifecycleState;
  if ("reconciliationRequired" in patch) values.reconciliationRequired = patch.reconciliationRequired ? 1 : 0;
  if ("failureReason" in patch) values.failureReason = patch.failureReason;
  if ("completedAt" in patch) values.completedAt = patch.completedAt;
  getDrizzleDatabase().update(paymentAttempts).set(values).where(eq(paymentAttempts.id, id)).run();
  return getPaymentAttempt(id)!;
}

export function recordPaymentEvent(paymentAttemptId: string, eventType: string, providerState: string | null, payload: unknown) {
  getDrizzleDatabase().insert(paymentEvents).values({
    id: "payment_event_" + randomUUID(),
    paymentAttemptId,
    eventType,
    providerState,
    payloadJson: payload === undefined ? null : JSON.stringify(payload),
    createdAt: Date.now()
  }).run();
}

export function storePaymentReceipts(
  paymentAttemptId: string,
  providerTransactionId: string,
  receipts: Array<{ data: string; mimeType: string; printed: boolean; receiptType: string }>
) {
  const now = Date.now();
  for (const receipt of receipts) {
    const dataBase64 = validateReceiptData(receipt.data);
    const mimeType = validateReceiptMimeType(receipt.mimeType);
    getDrizzleDatabase().insert(paymentReceipts).values({
      id: "payment_receipt_" + randomUUID(),
      paymentAttemptId,
      providerTransactionId,
      receiptType: receipt.receiptType || "UNKNOWN",
      mimeType,
      dataBase64,
      printedByProvider: receipt.printed ? 1 : 0,
      printJobId: null,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [paymentReceipts.paymentAttemptId, paymentReceipts.receiptType],
      set: {
        mimeType,
        dataBase64,
        printedByProvider: receipt.printed ? 1 : 0,
        updatedAt: now
      }
    }).run();
  }
}

function validateReceiptData(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 28_000_000 || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Wallee receipt contains invalid Base64 data.");
  }
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== normalized) throw new Error("Wallee receipt contains invalid Base64 data.");
  return normalized;
}

function validateReceiptMimeType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "application/pdf" || normalized === "text/plain" || normalized.startsWith("text/plain;")) return normalized;
  throw new Error("Unsupported Wallee receipt MIME type.");
}

export function ensurePaymentRecoveryJob(paymentAttemptId: string, operation: "RECONCILE" | "FETCH_RECEIPTS" | "VOID") {
  const now = Date.now();
  getDrizzleDatabase().insert(paymentRecoveryJobs).values({
    id: "payment_recovery_" + randomUUID(),
    paymentAttemptId,
    operation,
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: [paymentRecoveryJobs.paymentAttemptId, paymentRecoveryJobs.operation],
    set: { status: "PENDING", nextAttemptAt: now, updatedAt: now }
  }).run();
}

export function listDuePaymentRecoveryJobs(now = Date.now()) {
  return getDrizzleDatabase().select().from(paymentRecoveryJobs).where(and(
    inArray(paymentRecoveryJobs.status, ["PENDING", "FAILED"]),
    lte(paymentRecoveryJobs.nextAttemptAt, now)
  )).all();
}

export function ensureRecoveryJobsForIncompleteAttempts() {
  const recoverable = getDrizzleDatabase().select().from(paymentAttempts).where(inArray(paymentAttempts.lifecycleState, [
    "provider_pending",
    "provider_authorized",
    "provider_completed",
    "reconciliation_required",
    "reversal_required"
  ])).all();
  for (const attempt of recoverable) {
    if (!attempt.providerTransactionId) continue;
    if (attempt.paymentId && attempt.lifecycleState !== "reversal_required") continue;
    ensurePaymentRecoveryJob(attempt.id, attempt.lifecycleState === "reversal_required" ? "VOID" : "RECONCILE");
  }
}

export function completePaymentRecoveryJob(id: string) {
  getDrizzleDatabase().update(paymentRecoveryJobs).set({ status: "COMPLETED", lastError: null, updatedAt: Date.now() }).where(eq(paymentRecoveryJobs.id, id)).run();
}

export function completePaymentRecoveryJobsForAttempt(paymentAttemptId: string, operation: "RECONCILE" | "FETCH_RECEIPTS" | "VOID") {
  getDrizzleDatabase().update(paymentRecoveryJobs).set({ status: "COMPLETED", lastError: null, updatedAt: Date.now() }).where(and(
    eq(paymentRecoveryJobs.paymentAttemptId, paymentAttemptId),
    eq(paymentRecoveryJobs.operation, operation)
  )).run();
}

export function failPaymentRecoveryJob(id: string, attemptCount: number, error: string) {
  const delay = Math.min(300_000, 2 ** Math.min(attemptCount, 8) * 1_000);
  getDrizzleDatabase().update(paymentRecoveryJobs).set({
    status: "FAILED",
    attemptCount,
    nextAttemptAt: Date.now() + delay,
    lastError: error,
    updatedAt: Date.now()
  }).where(eq(paymentRecoveryJobs.id, id)).run();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "__undefined";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ":" + stableStringify(item))
    .join(",") + "}";
}
