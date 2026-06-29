import type { FastifyInstance } from "fastify";

import { createOrderSchema } from "./schemas.js";
import { createOrder, listOpenOrders, listProducts, listTables } from "./store.js";
import type { OrderDraft } from "./types.js";
import { broadcast, connectedClientCount } from "./realtime.js";

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "localRealtimeManager",
    clients: connectedClientCount(),
    orders: listOpenOrders().length
  }));

  app.get("/api/catalog", async () => ({ data: listProducts() }));

  app.get("/api/tables", async () => ({ data: listTables() }));

  app.get("/api/orders/open", async () => ({ data: listOpenOrders() }));

  app.post<{ Body: OrderDraft }>("/api/orders", { schema: createOrderSchema }, async (request, reply) => {
    const { order, table } = createOrder(request.body);

    broadcast("ORDER_CREATED", { order });
    broadcast("TABLE_UPDATED", { table });

    return reply.code(201).send({ success: true, order });
  });
}
