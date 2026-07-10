import type { BasketLine, PaymentLifecycleState, StartWalleeTerminalPaymentRequest, TableContext } from "../types.js";

export type PaymentProviderCode = "LOCAL" | "WALLEE_CLOUD_TILL";

export type PaymentProviderRequest = {
  request_id: string;
  amount: number;
  lines: BasketLine[];
  table_context: TableContext | null;
  request: StartWalleeTerminalPaymentRequest;
};

export type PaymentProviderResult = {
  provider: PaymentProviderCode;
  payment_attempt_id: string | null;
  provider_transaction_id: string | null;
  provider_status: string;
  lifecycle_state: PaymentLifecycleState;
  authorized: boolean;
  reconciliation_required: boolean;
  failure_reason: string | null;
};
