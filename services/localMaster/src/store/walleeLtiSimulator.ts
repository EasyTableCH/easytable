import type { PaymentProviderRequest, PaymentProviderResult } from "./paymentProviderTypes.js";

export function startWalleeLtiSimulatorPayment(request: PaymentProviderRequest): PaymentProviderResult {
  // Keep simulator outcomes aligned with provider-level terminal results. The local
  // order/payment close must stay in orderStore after an authorized result.
  const outcome = request.simulator_outcome ?? "APPROVED";

  if (outcome === "DECLINED") {
    return providerFailure(request.request_id, "DECLINED", "Wallee simulator declined the payment.");
  }

  if (outcome === "CANCELLED") {
    return providerFailure(request.request_id, "CANCELLED", "Wallee simulator payment was cancelled.");
  }

  if (outcome === "TIMEOUT") {
    return providerFailure(request.request_id, "TIMEOUT", "Wallee simulator payment timed out.");
  }

  return {
    provider: "WALLEE_LTI_SIMULATOR",
    provider_transaction_id: "wallee_sim_" + request.request_id,
    provider_status: "AUTHORIZED",
    authorized: true,
    failure_reason: null
  };
}

function providerFailure(
  requestId: string,
  providerStatus: PaymentProviderResult["provider_status"],
  failureReason: string
): PaymentProviderResult {
  return {
    provider: "WALLEE_LTI_SIMULATOR",
    provider_transaction_id: "wallee_sim_" + requestId,
    provider_status: providerStatus,
    authorized: false,
    failure_reason: failureReason
  };
}
