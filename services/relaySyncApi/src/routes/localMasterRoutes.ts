import type { FastifyInstance } from "fastify";

import { ackRelayCommand, getLocalMasterBootstrap, listPendingRelayCommands, pairLocalMaster } from "../store/provisioningStore.js";
import type { LocalMasterPairRequest, RelayCommandAckRequest } from "../types.js";

export async function registerLocalMasterRoutes(app: FastifyInstance) {
  app.post<{ Body: LocalMasterPairRequest }>("/api/local-masters/pair", async (request, reply) =>
    reply.code(201).send(await pairLocalMaster(request.body))
  );

  app.get("/api/local-masters/commands/pending", async (request) =>
    ({ data: await listPendingRelayCommands(readBearerToken(request.headers.authorization)) })
  );

  app.get("/api/local-masters/bootstrap", async (request) =>
    getLocalMasterBootstrap(readBearerToken(request.headers.authorization))
  );

  app.post<{ Params: { commandId: string }; Body: RelayCommandAckRequest }>(
    "/api/local-masters/commands/:commandId/ack",
    async (request) => ackRelayCommand(readBearerToken(request.headers.authorization), request.params.commandId, request.body)
  );
}

function readBearerToken(authorization: string | undefined) {
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}
