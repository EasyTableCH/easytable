import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { getDrizzleDatabase } from "../db/client.js";
import { locations, tenantUserLocations, tenantUsers, tenants } from "../db/schema.js";
import { completeAccountSetup, getAccountSetupContext } from "../store/accountSetupStore.js";
import type { AccountSetupCompleteRequest } from "../types.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (request, reply) => {
    const host = request.headers.host ?? "localhost";
    const protocol = request.headers["x-forwarded-proto"] as string ?? request.protocol ?? "http";
    const url = new URL(request.url, `${protocol}://${host}`);
    const headers = fromNodeHeaders(request.headers);

    const req = new Request(url.toString(), {
      method: "GET",
      headers,
    });

    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const db = getDrizzleDatabase();
    const userTenants = await db
      .select({
        tenantId: tenantUsers.tenantId,
        role: tenantUsers.role,
        tenantName: tenants.name,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .where(eq(tenantUsers.userId, session.user.id));

    const isPlatformAdmin = session.user.role === "platform_admin";
    const availableLocations = isPlatformAdmin
      ? await db
        .select({
          tenantId: locations.tenantId,
          id: locations.id,
          name: locations.name,
          status: locations.status,
          serviceMode: locations.serviceMode,
          localMasterInstanceId: locations.localMasterInstanceId,
        })
        .from(locations)
        .where(eq(locations.status, "ACTIVE"))
      : await db
        .select({
          tenantId: locations.tenantId,
          id: locations.id,
          name: locations.name,
          status: locations.status,
          serviceMode: locations.serviceMode,
          localMasterInstanceId: locations.localMasterInstanceId,
        })
        .from(tenantUserLocations)
        .innerJoin(locations, and(
          eq(tenantUserLocations.tenantId, locations.tenantId),
          eq(tenantUserLocations.locationId, locations.id),
        ))
        .where(and(
          eq(tenantUserLocations.userId, session.user.id),
          eq(tenantUserLocations.isActive, 1),
          eq(locations.status, "ACTIVE"),
        ));

    const tenantRows = isPlatformAdmin
      ? await db.select({ tenantId: tenants.id, tenantName: tenants.name }).from(tenants).where(eq(tenants.status, "ACTIVE"))
      : userTenants;

    return {
      user: session.user,
      tenants: tenantRows.map((tenant) => ({
        ...tenant,
        role: isPlatformAdmin ? "platform_admin" : ("role" in tenant ? tenant.role : "platform_admin"),
        locations: availableLocations
          .filter((location) => location.tenantId === tenant.tenantId)
          .map((location) => ({
            id: location.id,
            name: location.name,
            status: location.status,
            serviceMode: location.serviceMode,
            localMasterInstanceId: location.localMasterInstanceId,
            connectionStatus: location.localMasterInstanceId ? "PAIRED" : "UNPAIRED",
          })),
      })),
    };
  });

  app.get<{ Params: { token: string } }>("/api/auth/account-setup/:token", async (request) =>
    getAccountSetupContext(request.params.token)
  );

  app.post<{ Params: { token: string }; Body: AccountSetupCompleteRequest }>("/api/auth/account-setup/:token", async (request) =>
    completeAccountSetup(request.params.token, request.body ?? {})
  );

  app.all("/api/auth/*", async (request, reply) => {
    const host = request.headers.host ?? "localhost";
    const protocol = request.headers["x-forwarded-proto"] as string ?? request.protocol ?? "http";
    const url = new URL(request.url, `${protocol}://${host}`);

    const headers = fromNodeHeaders(request.headers);

    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body && request.method !== "GET"
        ? { body: JSON.stringify(request.body) }
        : {}),
    });

    const response = await auth.handler(req);

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    return reply.send(response.body ? await response.text() : null);
  });
}
