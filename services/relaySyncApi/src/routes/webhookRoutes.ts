import type { FastifyInstance } from "fastify";

import { acceptWalleeWebhook } from "../store/walleePaymentStore.js";

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post<{ Params: { profileId: string }; Body: unknown }>(
    "/api/webhooks/wallee/:profileId",
    async (request, reply) => {
      const signature = Array.isArray(request.headers["x-signature"])
        ? request.headers["x-signature"][0]
        : request.headers["x-signature"];

      return reply.code(202).send(await acceptWalleeWebhook(request.params.profileId, request.body, signature));
    }
  );
}
