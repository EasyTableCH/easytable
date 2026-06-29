import type { FastifyInstance } from "fastify";

import {
  completeMockPaymentSchema,
  createPairingSessionSchema,
  currentBusinessDateSchema,
  dayClosePreviewSchema,
  pairTerminalSchema,
  createOrderSchema,
  createOrderSnapshotSchema,
  saveDayCloseSchema,
  terminalHeartbeatSchema
} from "./schemas.js";
import {
  createPairingSession,
  getLocalMasterIdentity,
  pairTerminal,
  recordTerminalHeartbeat
} from "./pairing.js";
import {
  completeMockPayment,
  getCurrentBusinessDate,
  getDayClosePreview,
  createOrder,
  createOrderSnapshot,
  getOpenTableOrderBasket,
  getTableLayout,
  listOpenOrders,
  listProductVariantGroups,
  listProducts,
  listTables,
  loadPosSettings,
  saveDayClose
} from "./store.js";
import type {
  CompleteMockPaymentRequest,
  CurrentBusinessDateRequest,
  DayClosePreviewRequest,
  CreateOrderSnapshotRequest,
  SaveDayCloseRequest,
  OrderDraft,
  PairTerminalRequest,
  PairingSessionRequest,
  TerminalHeartbeatRequest
} from "./types.js";
import { broadcast, connectedClientCount } from "./realtime.js";

type PosRequestBody<TRequest> = {
  request: TRequest;
};

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ...getLocalMasterIdentity(),
    clients: connectedClientCount(),
    orders: listOpenOrders().length
  }));

  app.get("/api/local-master/identity", async () => ({
    ...getLocalMasterIdentity(),
    clients: connectedClientCount(),
    orders: listOpenOrders().length
  }));

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

  app.get("/api/catalog", async () => ({ data: listProducts() }));

  app.get("/api/products", async () => ({ data: listProducts() }));

  app.get<{ Params: { productId: string } }>(
    "/api/product-variant-groups/:productId",
    async (request) => ({ data: listProductVariantGroups(request.params.productId) })
  );

  app.get("/api/tables", async () => ({ data: listTables() }));

  app.get("/api/table-layout", async () => getTableLayout());

  app.get<{ Params: { tableId: string } }>(
    "/api/tables/:tableId/open-basket",
    async (request) => getOpenTableOrderBasket(request.params.tableId)
  );

  app.get("/api/orders/open", async () => ({ data: listOpenOrders() }));
  app.get("/api/pos-settings", async () => loadPosSettings());

  app.post<{ Body: PosRequestBody<CurrentBusinessDateRequest> }>(
    "/api/business-date/current",
    { schema: currentBusinessDateSchema },
    async (request) => getCurrentBusinessDate(request.body.request)
  );

  app.post<{ Body: PosRequestBody<DayClosePreviewRequest> }>(
    "/api/day-close/preview",
    { schema: dayClosePreviewSchema },
    async (request) => getDayClosePreview(request.body.request)
  );

  app.post<{ Body: PosRequestBody<SaveDayCloseRequest> }>(
    "/api/day-close",
    { schema: saveDayCloseSchema },
    async (request, reply) => reply.code(201).send(saveDayClose(request.body.request))
  );

  app.post<{ Body: OrderDraft }>("/api/orders", { schema: createOrderSchema }, async (request, reply) => {
    const { order, table } = createOrder(request.body);

    broadcast("ORDER_CREATED", { order });
    broadcast("TABLE_UPDATED", { table });

    return reply.code(201).send({ success: true, order });
  });

  app.post<{ Body: PosRequestBody<CreateOrderSnapshotRequest> }>(
    "/api/order-snapshots",
    { schema: createOrderSnapshotSchema },
    async (request, reply) => {
      const { order, table } = createOrderSnapshot(request.body.request);

      broadcast("ORDER_CREATED", { order });
      broadcast("TABLE_UPDATED", { table });

      return reply.code(201).send(order);
    }
  );

  app.post<{ Body: PosRequestBody<CompleteMockPaymentRequest> }>(
    "/api/mock-payments/complete",
    { schema: completeMockPaymentSchema },
    async (request, reply) => {
      const { payment, table } = completeMockPayment(request.body.request);

      broadcast("PAYMENT_COMPLETED", { payment });
      broadcast("TABLE_UPDATED", { table });

      return reply.code(201).send(payment);
    }
  );
}