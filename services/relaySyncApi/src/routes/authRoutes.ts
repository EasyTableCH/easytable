import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { getDrizzleDatabase } from "../db/client.js";
import { tenantUsers, tenants, locations, users, tenantUserLocations } from "../db/schema.js";

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

    return {
      user: session.user,
      tenants: userTenants,
    };
  });

  app.get("/api/dev/seed-users", async (request, reply) => {
    try {
      const db = getDrizzleDatabase();

      // 1. Ensure Tenant exists
      const tenantId = "tenant_c647afe1-728c-4331-b85b-a636d97aaec8";
      await db.insert(tenants).values({
        id: tenantId,
        name: "Basilika",
        slug: "basilika",
        status: "ACTIVE",
      }).onConflictDoNothing();

      // 2. Ensure Location exists
      const locationId = "loc_bf630add-590c-401e-916e-8ce2b2853d96";
      await db.insert(locations).values({
        id: locationId,
        tenantId,
        name: "Hauptstandort",
        slug: "hauptstandort",
        status: "ACTIVE",
        serviceMode: "TABLE_SERVICE",
      }).onConflictDoNothing();

      // 3. Create platform admin user
      try {
        await auth.api.signUpEmail({
          body: {
            email: "admin@easytable.de",
            password: "admin123",
            name: "Platform Admin",
          },
        });
      } catch (e) {
        // Ignore if already exists
      }

      // Update role/status for admin user (runs whether newly created or already existed)
      await db.update(users).set({
        role: "platform_admin",
        status: "ACTIVE",
      }).where(eq(users.email, "admin@easytable.de"));

      // 4. Create owner user
      try {
        await auth.api.signUpEmail({
          body: {
            email: "owner@basilika.de",
            password: "owner123",
            name: "Basilika Owner",
          },
        });
      } catch (e) {
        // Ignore if already exists
      }

      // Update status and establish links for owner user (runs whether newly created or already existed)
      await db.update(users).set({
        status: "ACTIVE",
      }).where(eq(users.email, "owner@basilika.de"));

      const userRow = await db.select().from(users).where(eq(users.email, "owner@basilika.de")).limit(1);
      if (userRow[0]) {
        // Link to tenant
        await db.insert(tenantUsers).values({
          tenantId,
          userId: userRow[0].id,
          role: "OWNER",
        }).onConflictDoNothing();

        // Link to location
        await db.insert(tenantUserLocations).values({
          tenantId,
          locationId,
          userId: userRow[0].id,
          isActive: 1,
        }).onConflictDoNothing();
      }

      return { ok: true, message: "Users and Tenants seeded successfully!" };
    } catch (err: any) {
      console.error("Seeding failed:", err);
      return reply.status(500).send({ error: err.message, stack: err.stack });
    }
  });

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
