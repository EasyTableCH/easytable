import {
  completePaymentRecoveryJob,
  ensureRecoveryJobsForIncompleteAttempts,
  failPaymentRecoveryJob,
  getPaymentAttempt,
  getPaymentAttemptByProviderTransactionId,
  listDuePaymentRecoveryJobs,
  recordPaymentEvent,
  storePaymentReceipts,
  updatePaymentAttempt
} from "./store/paymentAttemptStore.js";
import { getActiveWalleeConfig } from "./store/walleeConfigStore.js";
import { mapWalleeProviderState, WalleeClient } from "./store/walleeClient.js";
import { finalizeRecoveredWalleePaymentAttempt } from "./store/orderStore.js";

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startPaymentRecoveryWorker(intervalMs = positiveInteger(process.env.PAYMENT_RECOVERY_INTERVAL_MS, 15_000)) {
  if (timer) return;
  void processPaymentRecoveryJobs();
  timer = setInterval(() => void processPaymentRecoveryJobs(), intervalMs);
  timer.unref();
}

export function stopPaymentRecoveryWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function processPaymentRecoveryJobs() {
  if (running) return;
  running = true;
  try {
    ensureRecoveryJobsForIncompleteAttempts();
    for (const job of listDuePaymentRecoveryJobs()) {
      try {
        await processJob(job.paymentAttemptId, job.operation);
        completePaymentRecoveryJob(job.id);
      } catch (error) {
        failPaymentRecoveryJob(job.id, job.attemptCount + 1, error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    running = false;
  }
}

export async function reconcilePaymentAttempt(paymentAttemptId: string) {
  return processJob(paymentAttemptId, "RECONCILE");
}

export async function reconcilePaymentByProviderTransactionId(transactionId: string) {
  const attempt = getPaymentAttemptByProviderTransactionId(transactionId);
  if (!attempt) return { ignored: true, reason: "unknown_provider_transaction" };
  await processJob(attempt.id, "RECONCILE");
  return { ignored: false, payment_attempt_id: attempt.id };
}

async function processJob(paymentAttemptId: string, operation: string) {
  const attempt = getPaymentAttempt(paymentAttemptId);
  if (!attempt) throw new Error("Payment attempt not found.");
  if (attempt.lifecycleState === "completed" && attempt.paymentId) return;
  if (!attempt.providerTransactionId) throw new Error("Payment attempt has no Wallee transaction id.");
  const config = getActiveWalleeConfig();
  const client = new WalleeClient(config.credentials);

  if (operation === "FETCH_RECEIPTS") {
    const receipts = await client.fetchReceipts(attempt.providerTransactionId);
    storePaymentReceipts(attempt.id, attempt.providerTransactionId, receipts);
    recordPaymentEvent(attempt.id, "PROVIDER_RECEIPTS_RECOVERED", attempt.providerState, { count: receipts.length });
    return;
  }

  if (operation === "VOID") {
    const result = await client.voidTransaction(attempt.providerTransactionId);
    updatePaymentAttempt(attempt.id, {
      providerState: "VOIDED",
      lifecycleState: "cancelled",
      reconciliationRequired: false,
      failureReason: null,
      completedAt: Date.now()
    });
    recordPaymentEvent(attempt.id, "PROVIDER_VOIDED", "VOIDED", result);
    return;
  }

  const transaction = await client.readTransaction(attempt.providerTransactionId);
  const mapped = mapWalleeProviderState(transaction.state);
  recordPaymentEvent(attempt.id, "PROVIDER_RECONCILED", mapped.providerState, transaction);
  updatePaymentAttempt(attempt.id, {
    providerState: mapped.providerState,
    lifecycleState: mapped.lifecycleState,
    reconciliationRequired: !mapped.final,
    failureReason: mapped.final ? null : "Wallee transaction is still pending reconciliation."
  });
  if (!mapped.final) throw new Error("Wallee transaction is not final yet.");
  if (mapped.successful) finalizeRecoveredWalleePaymentAttempt(attempt.id);
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
