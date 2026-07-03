import type { BasketLine, TableContext, WalleeTerminalSimulatorOutcome } from "../types.js";

export type PaymentProviderCode = "LOCAL" | "WALLEE_LTI" | "WALLEE_LTI_SIMULATOR";

export type PaymentProviderRequest = {
  request_id: string;
  amount: number;
  terminal_id: string | null;
  lines: BasketLine[];
  table_context: TableContext | null;
  simulator_outcome?: WalleeTerminalSimulatorOutcome;
};

export type PaymentProviderResult = {
  provider: PaymentProviderCode;
  provider_transaction_id: string | null;
  provider_status: "AUTHORIZED" | "DECLINED" | "CANCELLED" | "TIMEOUT" | "UNKNOWN";
  authorized: boolean;
  failure_reason: string | null;
};

