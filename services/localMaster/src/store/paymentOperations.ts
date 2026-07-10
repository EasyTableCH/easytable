import {
  getPaymentAttemptByPaymentId,
  recordPaymentEvent,
  updatePaymentAttempt
} from "./paymentAttemptStore.js";
import { getActiveWalleeConfig } from "./walleeConfigStore.js";
import { WalleeClient } from "./walleeClient.js";

export async function voidWalleePayment(paymentId: string) {
  const { attempt, client } = context(paymentId);
  const result = await client.voidTransaction(attempt.providerTransactionId!);
  updatePaymentAttempt(attempt.id, {
    providerState: "VOIDED",
    lifecycleState: "cancelled",
    reconciliationRequired: false,
    completedAt: Date.now()
  });
  recordPaymentEvent(attempt.id, "PROVIDER_VOIDED", "VOIDED", result);
  return { payment_id: paymentId, payment_attempt_id: attempt.id, provider_transaction_id: attempt.providerTransactionId, provider_state: "VOIDED" };
}

export async function completeWalleePayment(paymentId: string) {
  const { attempt, client } = context(paymentId);
  const result = await client.completeTransaction(attempt.providerTransactionId!);
  recordPaymentEvent(attempt.id, "PROVIDER_COMPLETION_REQUESTED", attempt.providerState, result);
  return { payment_id: paymentId, payment_attempt_id: attempt.id, provider_transaction_id: attempt.providerTransactionId, result };
}

export async function refundWalleePayment(paymentId: string, amount?: number) {
  const { attempt, client } = context(paymentId);
  const refundAmount = amount ?? attempt.amount;
  if (refundAmount > attempt.amount) throw new Error("Refund amount cannot exceed the original payment amount.");
  const result = await client.refundTransaction(attempt.providerTransactionId!, refundAmount);
  recordPaymentEvent(attempt.id, "PROVIDER_REFUND_REQUESTED", attempt.providerState, { amount: refundAmount, result });
  return { payment_id: paymentId, payment_attempt_id: attempt.id, provider_transaction_id: attempt.providerTransactionId, amount: refundAmount, result };
}

function context(paymentId: string) {
  const attempt = getPaymentAttemptByPaymentId(paymentId);
  if (!attempt?.providerTransactionId) throw new Error("Wallee payment attempt not found for payment.");
  const config = getActiveWalleeConfig();
  return { attempt, client: new WalleeClient(config.credentials) };
}
