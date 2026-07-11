import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { registerApiRoutes } from "./routes.js";
import { registerRealtimeRoutes } from "./realtime.js";

export type ServerOptions = {
  logger?: boolean;
};

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        allErrors: true
      }
    }
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-EasyTable-Device-Id", "X-EasyTable-Device-Secret"]
  });

  await app.register(websocket, {
    options: {
      maxPayload: 16 * 1024
    }
  });

  const staffDist = process.env.LOCAL_MASTER_STAFF_DIST
    ? resolve(process.env.LOCAL_MASTER_STAFF_DIST)
    : fileURLToPath(new URL("../../../apps/staff/dist", import.meta.url));
  if (existsSync(staffDist)) {
    await app.register(staticFiles, { root: staffDist, prefix: "/staff/", wildcard: false });
    app.get("/staff", async (_request, reply) => reply.redirect("/staff/"));
    app.get("/staff/*", async (_request, reply) => reply.sendFile("index.html"));
  }

  await app.register(registerApiRoutes);
  await app.register(registerRealtimeRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

    request.log.warn({ error }, "Request failed");

    return reply.code(statusCode).send({
      error: statusCode >= 500 ? "Internal server error" : error.message
    });
  });

  return app;
}

