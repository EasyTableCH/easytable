import type { FastifyInstance } from "fastify";

import { reconcilePaymentAttempt } from "../paymentRecoveryWorker.js";
import { getPaymentAttempt } from "../store/paymentAttemptStore.js";
import { completeWalleePayment, refundWalleePayment, voidWalleePayment } from "../store/paymentOperations.js";

export async function registerPaymentRoutes(app: FastifyInstance) {
  app.get<{ Params: { attemptId: string } }>("/api/payments/attempts/:attemptId", async (request) => safeAttempt(request.params.attemptId));

  app.post<{ Params: { attemptId: string } }>("/api/payments/attempts/:attemptId/reconcile", async (request) => {
    await reconcilePaymentAttempt(request.params.attemptId);
    return safeAttempt(request.params.attemptId);
  });

  app.post<{ Params: { paymentId: string } }>("/api/payments/:paymentId/void", async (request) => voidWalleePayment(request.params.paymentId));
  app.post<{ Params: { paymentId: string } }>("/api/payments/:paymentId/complete", async (request) => completeWalleePayment(request.params.paymentId));
  app.post<{ Params: { paymentId: string }; Body: { amount?: number } }>("/api/payments/:paymentId/refund", async (request) => {
    const amount = request.body?.amount;
    if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) throw new Error("Refund amount must be a positive integer in minor units.");
    return refundWalleePayment(request.params.paymentId, amount);
  });
}

function safeAttempt(attemptId: string) {
  const attempt = getPaymentAttempt(attemptId);
  if (!attempt) throw new Error("Payment attempt not found.");
  return {
    payment_attempt_id: attempt.id,
    request_id: attempt.requestId,
    order_id: attempt.orderId,
    payment_id: attempt.paymentId,
    amount: attempt.amount,
    currency: attempt.currency,
    method: attempt.method,
    provider_transaction_id: attempt.providerTransactionId,
    provider_state: attempt.providerState,
    lifecycle_state: attempt.lifecycleState,
    reconciliation_required: attempt.reconciliationRequired === 1,
    failure_reason: attempt.failureReason,
    created_at: attempt.createdAt,
    updated_at: attempt.updatedAt,
    completed_at: attempt.completedAt
  };
}
