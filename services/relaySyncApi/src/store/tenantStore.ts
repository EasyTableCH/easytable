import { randomUUID } from "node:crypto";

import { and, asc, eq, ne, sql } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import { tenants } from "../db/schema.js";
import type { Tenant, TenantCreateRequest, TenantStatus, TenantUpdateRequest } from "../types.js";
import { ApiError } from "./errors.js";

type TenantRow = typeof tenants.$inferSelect;

export async function listTenants(): Promise<Tenant[]> {
  const rows = await getDrizzleDatabase().select().from(tenants).orderBy(asc(tenants.name));
  return rows.map(toTenant);
}

export async function createTenant(request: TenantCreateRequest): Promise<Tenant> {
  const now = new Date();
  const input = normalizeTenantInput(request);
  await ensureUniqueSlug(input.slug);

  const id = "tenant_" + randomUUID();
  const rows = await getDrizzleDatabase()
    .insert(tenants)
    .values({
      id,
      name: input.name,
      slug: input.slug,
      email: input.email,
      phone: input.phone,
      website: input.website,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toTenant(rows[0]);
}

export async function updateTenant(tenantId: string, request: TenantUpdateRequest): Promise<Tenant> {
  const current = await requireTenant(tenantId);
  const input = normalizeTenantInput({
    name: request.name ?? current.name,
    slug: request.slug ?? current.slug,
    email: request.email === undefined ? current.email : request.email,
    phone: request.phone === undefined ? current.phone : request.phone,
    website: request.website === undefined ? current.website : request.website,
    status: request.status ?? current.status,
  });

  if (input.slug !== current.slug) {
    await ensureUniqueSlug(input.slug, tenantId);
  }

  const rows = await getDrizzleDatabase()
    .update(tenants)
    .set({
      name: input.name,
      slug: input.slug,
      email: input.email,
      phone: input.phone,
      website: input.website,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();

  return toTenant(rows[0]);
}

async function requireTenant(tenantId: string) {
  const rows = await getDrizzleDatabase().select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = rows[0];

  if (!tenant) {
    throw new ApiError("Tenant not found.", 404);
  }

  return toTenant(tenant);
}

async function ensureUniqueSlug(slug: string, exceptTenantId?: string) {
  const rows = await getDrizzleDatabase()
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(sql`lower(${tenants.slug}) = lower(${slug})`, ne(tenants.id, exceptTenantId ?? "")))
    .limit(1);

  if (rows[0]) {
    throw new ApiError("Tenant slug already exists.", 409);
  }
}

function normalizeTenantInput(request: TenantCreateRequest): Required<TenantCreateRequest> {
  const name = normalizeName(request.name, "Tenant name is required.");
  const slug = normalizeSlug(request.slug);
  const status = normalizeStatus(request.status ?? "ACTIVE");

  return {
    name,
    slug,
    email: normalizeOptionalText(request.email),
    phone: normalizeOptionalText(request.phone),
    website: normalizeOptionalText(request.website),
    status,
  };
}

function normalizeName(value: string | undefined, message: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new ApiError(message);
  return normalized;
}

function normalizeSlug(value: string | undefined) {
  const slug = value?.trim().toLowerCase() ?? "";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ApiError("Tenant slug must use lowercase letters, numbers, and hyphens.");
  }

  return slug;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: string): TenantStatus {
  if (value !== "ACTIVE" && value !== "SUSPENDED") {
    throw new ApiError("Tenant status must be ACTIVE or SUSPENDED.");
  }

  return value;
}

function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    email: row.email,
    phone: row.phone,
    website: row.website,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
