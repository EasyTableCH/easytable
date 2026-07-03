import type { FastifyInstance } from "fastify";

import { getCloudBinding } from "../cloudBinding.js";
import { getLocalMasterIdentity } from "../pairing.js";
import { connectedClientCount } from "../realtime.js";
import { listOpenOrders } from "../store.js";

function getHealthPayload() {
  return {
    ...getLocalMasterIdentity(),
    cloud_binding: getCloudBinding(),
    clients: connectedClientCount(),
    orders: listOpenOrders().length
  };
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => getHealthPayload());
  app.get("/api/local-master/identity", async () => getHealthPayload());
}
