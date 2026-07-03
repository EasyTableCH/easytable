import type { FastifyInstance } from "fastify";

import { getCloudBinding, pairCloudRelay, retryCloudBootstrap } from "../cloudBinding.js";
import { createPairingSession, pairTerminal, recordTerminalHeartbeat } from "../pairing.js";
import { createPairingSessionSchema, pairTerminalSchema, terminalHeartbeatSchema } from "../schemas.js";
import type { CloudPairRequest, PairingSessionRequest, PairTerminalRequest, TerminalHeartbeatRequest } from "../types.js";
import type { PosRequestBody } from "./types.js";

export async function registerPairingRoutes(app: FastifyInstance) {
  app.get("/api/local-master/cloud-binding", async () => getCloudBinding());

  app.post<{ Body: PosRequestBody<CloudPairRequest> }>(
    "/api/local-master/cloud-pair",
    async (request, reply) => reply.code(201).send(await pairCloudRelay(request.body.request))
  );

  app.post(
    "/api/local-master/cloud-bootstrap",
    async (request, reply) => reply.code(200).send(await retryCloudBootstrap())
  );

  app.post<{ Body: PosRequestBody<PairingSessionRequest> }>(
    "/api/local-master/pairing-sessions",
    { schema: createPairingSessionSchema },
    async (request, reply) => reply.code(201).send(createPairingSession(request.body.request))
  );

  app.post<{ Body: PosRequestBody<PairTerminalRequest> }>(
    "/api/local-master/pair",
    { schema: pairTerminalSchema },
    async (request, reply) => reply.code(201).send(pairTerminal(request.body.request))
  );

  app.post<{ Params: { terminalId: string }; Body: PosRequestBody<TerminalHeartbeatRequest> }>(
    "/api/local-master/terminals/:terminalId/heartbeat",
    { schema: terminalHeartbeatSchema },
    async (request) => recordTerminalHeartbeat(request.params.terminalId, request.body.request)
  );
}
