import { createCipheriv, createDecipheriv, createHash, createVerify, randomBytes, randomUUID } from "node:crypto";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import {
  locations,
  relayCommands,
  tenants,
  walleePaymentProfiles,
  walleePaymentTerminals,
  walleeWebhookEvents
} from "../db/schema.js";
import type {
  LocalMasterPaymentConfig,
  WalleePaymentProfile,
  WalleePaymentProfileUpsertRequest,
  WalleePaymentTerminal,
  WalleePaymentTerminalCreateRequest,
  WalleePaymentTerminalUpdateRequest
} from "../types.js";
import { ApiError } from "./errors.js";
import { requireLocalMasterCredential } from "./provisioningStore.js";

type WalleeProfileRow = typeof walleePaymentProfiles.$inferSelect;
type WalleeTerminalRow = typeof walleePaymentTerminals.$inferSelect;

export async function getWalleePaymentProfile(tenantId: string, locationId: string): Promise<WalleePaymentProfile | null> {
  await requireLocation(tenantId, locationId);
  const row = await getProfileRow(tenantId, locationId);
  return row ? toPaymentProfile(row) : null;
}

export async function upsertWalleePaymentProfile(
  tenantId: string,
  locationId: string,
  request: WalleePaymentProfileUpsertRequest
): Promise<WalleePaymentProfile> {
  await requireLocation(tenantId, locationId);
  const input = normalizeProfileInput(request);
  const existing = await getProfileRow(tenantId, locationId);
  const now = new Date();
  if (!existing && !input.applicationUserSecret) throw new ApiError("Application user secret is required for a new wallee profile.");
  const secret = input.applicationUserSecret ? encryptSecret(input.applicationUserSecret) : existing?.applicationUserSecretEncrypted;
  if (!secret) throw new ApiError("Application user secret is required.");

  const values = {
    tenantId,
    locationId,
    spaceId: input.spaceId,
    applicationUserId: input.applicationUserId,
    applicationUserSecretEncrypted: secret,
    webhookSignatureKey: input.webhookSignatureKey ?? existing?.webhookSignatureKey ?? null,
    mode: "CLOUD_TILL_LONG_POLLING",
    enabled: input.enabled ? 1 : 0,
    updatedAt: now
  };
  const rows = existing
    ? await getDrizzleDatabase().update(walleePaymentProfiles).set({
        ...values,
        configVersion: sql`${walleePaymentProfiles.configVersion} + 1`
      }).where(eq(walleePaymentProfiles.id, existing.id)).returning()
    : await getDrizzleDatabase().insert(walleePaymentProfiles).values({ id: "wallee_profile_" + randomUUID(), ...values, configVersion: 1, createdAt: now }).returning();
  await publishWalleeConfigUpdate(rows[0]);
  return toPaymentProfile(rows[0]);
}

export async function listWalleePaymentTerminals(tenantId: string, locationId: string): Promise<WalleePaymentTerminal[]> {
  const profile = await requireProfile(tenantId, locationId);
  const rows = await getDrizzleDatabase().select().from(walleePaymentTerminals)
    .where(eq(walleePaymentTerminals.profileId, profile.id)).orderBy(asc(walleePaymentTerminals.displayName));
  return rows.map(toPaymentTerminal);
}

export async function createWalleePaymentTerminal(
  tenantId: string,
  locationId: string,
  request: WalleePaymentTerminalCreateRequest
): Promise<WalleePaymentTerminal> {
  const profile = await requireProfile(tenantId, locationId);
  const input = normalizeTerminalInput(request);
  const now = new Date();
  const rows = await getDrizzleDatabase().transaction(async (tx) => {
    const existingTerminals = await tx.select({ id: walleePaymentTerminals.id }).from(walleePaymentTerminals).where(eq(walleePaymentTerminals.profileId, profile.id));
    const isDefault = input.isDefault || existingTerminals.length === 0;
    if (isDefault) await tx.update(walleePaymentTerminals).set({ isDefault: 0, updatedAt: now }).where(eq(walleePaymentTerminals.profileId, profile.id));
    const inserted = await tx.insert(walleePaymentTerminals).values({
      id: "wallee_terminal_" + randomUUID(), profileId: profile.id, tenantId, locationId,
      displayName: input.displayName, terminalId: input.terminalId, terminalIdentifier: input.terminalIdentifier,
      isDefault: isDefault ? 1 : 0, isActive: input.isActive ? 1 : 0, createdAt: now, updatedAt: now
    }).returning();
    await tx.update(walleePaymentProfiles).set({ configVersion: sql`${walleePaymentProfiles.configVersion} + 1`, updatedAt: now }).where(eq(walleePaymentProfiles.id, profile.id));
    return inserted;
  });
  await publishWalleeConfigUpdate((await requireProfile(tenantId, locationId)));
  return toPaymentTerminal(rows[0]);
}

export async function updateWalleePaymentTerminal(
  tenantId: string,
  locationId: string,
  terminalId: string,
  request: WalleePaymentTerminalUpdateRequest
): Promise<WalleePaymentTerminal> {
  const current = await requireTerminal(tenantId, locationId, terminalId);
  const profile = await requireProfile(tenantId, locationId);
  const input = normalizeTerminalInput({
    display_name: request.display_name ?? current.displayName,
    terminal_id: request.terminal_id ?? current.terminalId,
    terminal_identifier: request.terminal_identifier ?? current.terminalIdentifier,
    is_default: request.is_default ?? current.isDefault === 1,
    is_active: request.is_active ?? current.isActive === 1
  });
  const now = new Date();
  const rows = await getDrizzleDatabase().transaction(async (tx) => {
    if (input.isDefault) await tx.update(walleePaymentTerminals).set({ isDefault: 0, updatedAt: now }).where(eq(walleePaymentTerminals.profileId, current.profileId));
    const updated = await tx.update(walleePaymentTerminals).set({
      displayName: input.displayName, terminalId: input.terminalId, terminalIdentifier: input.terminalIdentifier,
      isDefault: input.isDefault ? 1 : 0, isActive: input.isActive ? 1 : 0, updatedAt: now
    }).where(eq(walleePaymentTerminals.id, terminalId)).returning();
    await tx.update(walleePaymentProfiles).set({ configVersion: sql`${walleePaymentProfiles.configVersion} + 1`, updatedAt: now }).where(eq(walleePaymentProfiles.id, profile.id));
    return updated;
  });
  await publishWalleeConfigUpdate(await requireProfile(tenantId, locationId));
  return toPaymentTerminal(rows[0]);
}

export async function deleteWalleePaymentTerminal(tenantId: string, locationId: string, terminalId: string): Promise<void> {
  const terminal = await requireTerminal(tenantId, locationId, terminalId);
  const profile = await requireProfile(tenantId, locationId);
  const now = new Date();
  await getDrizzleDatabase().transaction(async (tx) => {
    await tx.delete(walleePaymentTerminals).where(eq(walleePaymentTerminals.id, terminal.id));
    await tx.update(walleePaymentProfiles).set({ configVersion: sql`${walleePaymentProfiles.configVersion} + 1`, updatedAt: now }).where(eq(walleePaymentProfiles.id, profile.id));
  });
  await publishWalleeConfigUpdate(await requireProfile(tenantId, locationId));
}

export async function getLocalMasterPaymentConfig(relayToken: string): Promise<LocalMasterPaymentConfig> {
  const credential = await requireLocalMasterCredential(relayToken);
  const profile = await getProfileRow(credential.tenantId, credential.locationId);
  const location = await requireLocationRow(credential.tenantId, credential.locationId);
  if (location.localMasterInstanceId !== credential.localMasterInstanceId) throw new ApiError("LocalMaster binding does not match location.", 409);
  if (!profile || profile.enabled !== 1) {
    return {
      config_version: profile?.configVersion ?? 0,
      checksum: checksumConfig(profile, []),
      tenant_id: credential.tenantId,
      location_id: credential.locationId,
      local_master_instance_id: credential.localMasterInstanceId,
      wallee: null
    };
  }
  const terminals = await getTerminalRows(profile.id);
  return {
    config_version: profile.configVersion,
    checksum: checksumConfig(profile, terminals),
    tenant_id: credential.tenantId,
    location_id: credential.locationId,
    local_master_instance_id: credential.localMasterInstanceId,
    wallee: {
      enabled: true,
      mode: "CLOUD_TILL_LONG_POLLING",
      profile_id: profile.id,
      space_id: profile.spaceId,
      application_user_id: profile.applicationUserId,
      authentication_key: decryptSecret(profile.applicationUserSecretEncrypted),
      confirmation_policy: "EXPLICIT",
      receipt_policy: "FETCH_AND_QUEUE_UNPRINTED",
      terminals: terminals.map(toPaymentTerminal)
    }
  };
}

export async function republishWalleeConfig(tenantId: string, locationId: string) {
  const profile = await requireProfile(tenantId, locationId);
  return publishWalleeConfigUpdate(profile, true);
}

export async function acceptWalleeWebhook(profileId: string, payload: unknown, signature: string | undefined, rawBody: string) {
  const profile = await requireProfileById(profileId);
  const event = normalizeWebhookPayload(payload);
  verifyWebhookSignature(profile, rawBody, signature);
  const now = new Date();
  try {
    const rows = await getDrizzleDatabase().insert(walleeWebhookEvents).values({
      id: "wallee_webhook_" + randomUUID(), profileId, eventId: event.eventId, entityId: event.entityId,
      listenerEntityId: event.listenerEntityId, listenerEntityTechnicalName: event.listenerEntityTechnicalName,
      payloadJson: payload, signature: signature ?? null, status: "verified", processedAt: null,
      error: null, createdAt: now, updatedAt: now
    }).returning();
    if (event.entityId && profile.locationId) await publishWalleeTransactionHint(profile, event);
    await getDrizzleDatabase().update(walleeWebhookEvents).set({ status: "processed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(walleeWebhookEvents.id, rows[0].id));
    return { accepted: true, duplicate: false, event_id: rows[0].eventId };
  } catch (error) {
    if (isUniqueViolation(error)) return { accepted: true, duplicate: true, event_id: event.eventId };
    throw error;
  }
}

async function publishWalleeConfigUpdate(profile: WalleeProfileRow, force = false) {
  if (!profile.locationId) return null;
  const location = await requireLocationRow(profile.tenantId, profile.locationId);
  if (!location.localMasterInstanceId) return null;
  const terminals = await getTerminalRows(profile.id);
  const checksum = checksumConfig(profile, terminals);
  const now = new Date();
  const rows = await getDrizzleDatabase().insert(relayCommands).values({
    id: "relay_wallee_config_" + randomUUID(), tenantId: profile.tenantId, locationId: profile.locationId,
    localMasterInstanceId: location.localMasterInstanceId, type: "WALLEE_CONFIG_VERSION_AVAILABLE", status: "pending",
    payloadJson: { config_version: profile.configVersion, checksum, changed_at: now.toISOString(), force },
    resultJson: null, deliveredAt: null, completedAt: null, createdAt: now, updatedAt: now
  }).returning();
  return rows[0];
}

async function publishWalleeTransactionHint(profile: WalleeProfileRow, event: ReturnType<typeof normalizeWebhookPayload>) {
  if (!profile.locationId || !event.entityId) return;
  const location = await requireLocationRow(profile.tenantId, profile.locationId);
  if (!location.localMasterInstanceId) return;
  const now = new Date();
  await getDrizzleDatabase().insert(relayCommands).values({
    id: "relay_wallee_event_" + randomUUID(), tenantId: profile.tenantId, locationId: profile.locationId,
    localMasterInstanceId: location.localMasterInstanceId, type: "WALLEE_TRANSACTION_CHANGED", status: "pending",
    payloadJson: { event_id: event.eventId, entity_id: event.entityId, profile_id: profile.id, occurred_at: now.toISOString() },
    resultJson: null, deliveredAt: null, completedAt: null, createdAt: now, updatedAt: now
  });
}

async function requireTenant(tenantId: string) {
  const row = (await getDrizzleDatabase().select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
  if (!row) throw new ApiError("Tenant not found.", 404);
}

async function requireLocation(tenantId: string, locationId: string) {
  await requireTenant(tenantId);
  await requireLocationRow(tenantId, locationId);
}

async function requireLocationRow(tenantId: string, locationId: string) {
  const row = (await getDrizzleDatabase().select().from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId))).limit(1))[0];
  if (!row) throw new ApiError("Location not found.", 404);
  return row;
}

async function getProfileRow(tenantId: string, locationId: string) {
  return (await getDrizzleDatabase().select().from(walleePaymentProfiles)
    .where(and(eq(walleePaymentProfiles.tenantId, tenantId), eq(walleePaymentProfiles.locationId, locationId))).limit(1))[0] ?? null;
}

async function requireProfile(tenantId: string, locationId: string) {
  await requireLocation(tenantId, locationId);
  const profile = await getProfileRow(tenantId, locationId);
  if (!profile) throw new ApiError("Wallee profile is not configured for this location.", 404);
  return profile;
}

async function requireProfileById(profileId: string) {
  const profile = (await getDrizzleDatabase().select().from(walleePaymentProfiles).where(eq(walleePaymentProfiles.id, profileId)).limit(1))[0];
  if (!profile) throw new ApiError("Wallee profile not found.", 404);
  return profile;
}

async function getTerminalRows(profileId: string) {
  return getDrizzleDatabase().select().from(walleePaymentTerminals).where(eq(walleePaymentTerminals.profileId, profileId))
    .orderBy(asc(walleePaymentTerminals.displayName));
}

async function requireTerminal(tenantId: string, locationId: string, terminalId: string) {
  const row = (await getDrizzleDatabase().select().from(walleePaymentTerminals).where(and(
    eq(walleePaymentTerminals.id, terminalId), eq(walleePaymentTerminals.tenantId, tenantId), eq(walleePaymentTerminals.locationId, locationId)
  )).limit(1))[0];
  if (!row) throw new ApiError("Wallee terminal not found.", 404);
  return row;
}

function normalizeProfileInput(request: WalleePaymentProfileUpsertRequest) {
  return {
    spaceId: requiredText(request.space_id, "Wallee space_id is required."),
    applicationUserId: requiredText(request.application_user_id, "Wallee application_user_id is required."),
    applicationUserSecret: optionalText(request.application_user_secret),
    webhookSignatureKey: optionalText(request.webhook_signature_key),
    enabled: request.enabled ?? true
  };
}

function normalizeTerminalInput(request: WalleePaymentTerminalCreateRequest) {
  const terminalId = optionalText(request.terminal_id);
  const terminalIdentifier = optionalText(request.terminal_identifier);
  if (!terminalId && !terminalIdentifier) throw new ApiError("Terminal ID or terminal identifier is required.");
  return { displayName: requiredText(request.display_name, "Terminal display name is required."), terminalId, terminalIdentifier,
    isDefault: request.is_default ?? false, isActive: request.is_active ?? true };
}

function normalizeWebhookPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new ApiError("Webhook payload must be a JSON object.");
  const eventId = optionalText((payload as { eventId?: unknown }).eventId);
  if (!eventId) throw new ApiError("Webhook eventId is required.");
  return {
    eventId,
    entityId: optionalText((payload as { entityId?: unknown }).entityId),
    listenerEntityId: optionalText((payload as { listenerEntityId?: unknown }).listenerEntityId),
    listenerEntityTechnicalName: optionalText((payload as { listenerEntityTechnicalName?: unknown }).listenerEntityTechnicalName)
  };
}

async function toPaymentProfile(row: WalleeProfileRow): Promise<WalleePaymentProfile> {
  const command = row.locationId
    ? (await getDrizzleDatabase().select().from(relayCommands).where(and(
        eq(relayCommands.tenantId, row.tenantId),
        eq(relayCommands.locationId, row.locationId),
        eq(relayCommands.type, "WALLEE_CONFIG_VERSION_AVAILABLE")
      )).orderBy(desc(relayCommands.createdAt)).limit(1))[0]
    : null;
  const result = command?.resultJson && typeof command.resultJson === "object"
    ? command.resultJson as Record<string, unknown>
    : null;
  const nestedResult = result?.result && typeof result.result === "object" ? result.result as Record<string, unknown> : null;
  const activeVersionValue = result?.active_config_version ?? nestedResult?.active_config_version;
  const activeVersion = typeof activeVersionValue === "number" ? activeVersionValue : null;
  const deliveryStatus = command?.status === "pending" || command?.status === "delivered" || command?.status === "accepted" || command?.status === "failed"
    ? command.status
    : "unpublished";
  return {
    id: row.id, tenant_id: row.tenantId, location_id: row.locationId, space_id: row.spaceId,
    application_user_id: row.applicationUserId, has_application_user_secret: Boolean(row.applicationUserSecretEncrypted),
    has_webhook_signature_key: Boolean(row.webhookSignatureKey), mode: "CLOUD_TILL_LONG_POLLING",
    enabled: row.enabled === 1, config_version: row.configVersion,
    config_delivery: {
      status: deliveryStatus,
      active_local_master_version: activeVersion,
      error: command?.status === "failed" && typeof result?.error === "string" ? result.error : null,
      updated_at: command?.updatedAt?.toISOString() ?? null
    },
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString()
  };
}

function toPaymentTerminal(row: WalleeTerminalRow): WalleePaymentTerminal {
  return {
    id: row.id, profile_id: row.profileId, tenant_id: row.tenantId, location_id: row.locationId,
    display_name: row.displayName, terminal_id: row.terminalId, terminal_identifier: row.terminalIdentifier,
    is_default: row.isDefault === 1, is_active: row.isActive === 1,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString()
  };
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new ApiError("Stored wallee secret cannot be decrypted.", 500);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function encryptionKey() {
  const source = process.env.WALLEE_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!source) throw new ApiError("WALLEE_CREDENTIAL_ENCRYPTION_KEY is required to store or use wallee credentials.", 500);
  return createHash("sha256").update(source).digest();
}

function verifyWebhookSignature(profile: WalleeProfileRow, rawBody: string, signature: string | undefined) {
  if (!profile.webhookSignatureKey?.includes("BEGIN PUBLIC KEY")) throw new ApiError("Wallee webhook public key is required.", 500);
  if (!signature) throw new ApiError("Wallee webhook signature is required.", 401);
  const parsed = parseSignature(signature);
  if (parsed.algorithm && parsed.algorithm !== "SHA256withECDSA") throw new ApiError("Unsupported wallee webhook signature algorithm.", 401);
  const verifier = createVerify("sha256");
  verifier.update(rawBody);
  verifier.end();
  if (!verifier.verify(profile.webhookSignatureKey, Buffer.from(parsed.signature, "base64"))) throw new ApiError("Invalid wallee webhook signature.", 401);
}

function parseSignature(header: string) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)).filter(([key, value]) => key && value));
  return { signature: parts.signature ?? header, algorithm: parts.algorithm, keyId: parts.keyId };
}

function checksumConfig(profile: WalleeProfileRow | null, terminals: WalleeTerminalRow[]) {
  return createHash("sha256").update(JSON.stringify(profile ? {
    id: profile.id, tenantId: profile.tenantId, locationId: profile.locationId, spaceId: profile.spaceId,
    applicationUserId: profile.applicationUserId, secretRevision: createHash("sha256").update(profile.applicationUserSecretEncrypted).digest("hex"),
    mode: profile.mode, enabled: profile.enabled, configVersion: profile.configVersion,
    terminals: terminals.map((terminal) => ({ id: terminal.id, terminalId: terminal.terminalId, terminalIdentifier: terminal.terminalIdentifier,
      isDefault: terminal.isDefault, isActive: terminal.isActive, updatedAt: terminal.updatedAt.toISOString() }))
  } : { configVersion: 0, enabled: false })).digest("hex");
}

function requiredText(value: unknown, message: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new ApiError(message);
  return normalized;
}

function optionalText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: string }).code === "23505") return true;
  return "cause" in error && isUniqueViolation((error as { cause?: unknown }).cause);
}
