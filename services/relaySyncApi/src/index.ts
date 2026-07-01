import "dotenv/config";

import { buildServer } from "./server.js";

const port = Number(process.env.RELAY_SYNC_API_PORT ?? 3100);
const host = process.env.RELAY_SYNC_API_HOST ?? "0.0.0.0";

const app = await buildServer();

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "Shutting down relaySyncApi");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ error }, "Failed to start relaySyncApi");
  process.exit(1);
}
