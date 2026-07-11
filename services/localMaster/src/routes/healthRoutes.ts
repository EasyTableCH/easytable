import type { FastifyInstance } from "fastify";

import { getCloudBinding } from "../cloudBinding.js";
import { getLocalMasterIdentity } from "../pairing.js";
import { connectedClientCount } from "../realtime.js";
import { getWalleeConfigStatus, listOpenOrders } from "../store.js";
import { listDuePaymentRecoveryJobs } from "../store/paymentAttemptStore.js";
import { loadLocalSiteConfig } from "../store/localSiteStore.js";

function getHealthPayload() {
  return {
    ...getLocalMasterIdentity(),
    cloud_binding: getCloudBinding(),
    clients: connectedClientCount(),
    orders: listOpenOrders().length,
    payment_config: getWalleeConfigStatus()
  };
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => getHealthPayload());
  app.get("/api/local-master/identity", async () => getHealthPayload());
  app.get("/api/payment-config/status", async () => getWalleeConfigStatus());
  app.get("/api/runtime-context", async () => {
    const site = loadLocalSiteConfig();
    const identity = getLocalMasterIdentity();
    return {
      mode: "LOCAL",
      tenant_id: site.tenant.id,
      tenant_name: site.tenant.name,
      location_id: site.location.id,
      location_name: site.location.name,
      local_master_instance_id: identity.instance_id,
      service_mode: site.service_mode,
      api_version: identity.api_version,
    };
  });
  app.get("/api/update/status", async () => {
    const openOrderCount = listOpenOrders().length;
    const recoveryJobCount = listDuePaymentRecoveryJobs(Number.MAX_SAFE_INTEGER).length;
    const blockers = [
      ...(openOrderCount ? ["OPEN_ORDERS"] : []),
      ...(recoveryJobCount ? ["PAYMENT_RECOVERY_PENDING"] : []),
    ];
    return { safe_to_install: blockers.length === 0, blockers, open_order_count: openOrderCount, payment_recovery_job_count: recoveryJobCount };
  });
}
