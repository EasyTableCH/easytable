import type { FastifyInstance } from "fastify";

import { getSalesReportForBusinessDate, listOrderSnapshotsForReporting } from "../store.js";

export async function registerReportingRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { business_date?: string; business_day_cutover_time?: string } }>(
    "/api/reporting/sales",
    async (request) => {
      const businessDate = request.query.business_date?.trim();
      if (!businessDate) {
        throw new Error("business_date is required.");
      }

      return getSalesReportForBusinessDate(businessDate, request.query.business_day_cutover_time ?? "00:00");
    }
  );

  app.get<{
    Querystring: {
      from?: string;
      to?: string;
      query?: string;
      payment_method?: string;
      terminal_id?: string;
      storno_state?: string;
    };
  }>("/api/reporting/order-snapshots", async (request) =>
    listOrderSnapshotsForReporting({
      from: request.query.from,
      to: request.query.to,
      query: request.query.query,
      payment_method: request.query.payment_method,
      terminal_id: request.query.terminal_id,
      storno_state: request.query.storno_state
    })
  );
}
