import type { PaymentProviderRequest, PaymentProviderResult } from "./paymentProviderTypes.js";
import { startWalleeCloudTillPayment } from "./walleeCloudTillProvider.js";
import { startWalleeLtiSimulatorPayment } from "./walleeLtiSimulator.js";

export async function startWalleeLtiPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
  if (request.simulator_outcome) {
    return startWalleeLtiSimulatorPayment(request);
  }

  const cloudResult = await startWalleeCloudTillPayment(request);
  if (cloudResult.authorized || cloudResult.failure_reason !== "LocalMaster is not paired with relay for wallee terminal payments.") {
    return cloudResult;
  }

  return startWalleeLtiSimulatorPayment(request);
}
