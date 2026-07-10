import { getRelayRuntimeBinding } from "../cloudBinding.js";
import type { PaymentProviderRequest, PaymentProviderResult } from "./paymentProviderTypes.js";

type RelayWalleePaymentResponse = {
  provider: "WALLEE_CLOUD_TILL";
  provider_transaction_id: string | null;
  provider_status: PaymentProviderResult["provider_status"];
  authorized: boolean;
  failure_reason: string | null;
};

export async function startWalleeCloudTillPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
  const binding = getRelayRuntimeBinding();

  if (!binding) {
    return providerFailure("UNKNOWN", "LocalMaster is not paired with relay for wallee terminal payments.");
  }

  const response = await fetch(binding.relay_base_url.replace(/\/$/, "") + "/api/local-masters/payments/wallee-terminal/start", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + binding.relay_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      request_id: request.request_id,
      amount: request.amount,
      currency: "CHF",
      terminal_id: request.terminal_id,
      lines: request.lines,
      table_context: request.table_context
    })
  });

  if (!response.ok) {
    return providerFailure("UNKNOWN", await readRelayError(response));
  }

  return (await response.json()) as RelayWalleePaymentResponse;
}

function providerFailure(providerStatus: PaymentProviderResult["provider_status"], failureReason: string): PaymentProviderResult {
  return {
    provider: "WALLEE_CLOUD_TILL",
    provider_transaction_id: null,
    provider_status: providerStatus,
    authorized: false,
    failure_reason: failureReason
  };
}

async function readRelayError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "Wallee relay payment failed.";
  } catch {
    return (await response.text().catch(() => "")) || "Wallee relay payment failed.";
  }
}
