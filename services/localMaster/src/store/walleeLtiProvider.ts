import type { PaymentProviderRequest, PaymentProviderResult } from "./paymentProviderTypes.js";
import { startWalleeLtiSimulatorPayment } from "./walleeLtiSimulator.js";

export function startWalleeLtiPayment(request: PaymentProviderRequest): PaymentProviderResult {
  // TODO(wallee-lti): Replace the simulator call with the official LTI TCP/XML exchange
  // once the physical terminal model and exact LTI documentation version are known.
  // Do not guess message names or success states here; map the documented terminal
  // response into PaymentProviderResult and let localMaster complete the payment.
  return startWalleeLtiSimulatorPayment(request);
}
