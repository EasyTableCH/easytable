import { createCipheriv, createDecipheriv, createHash, createHmac, createVerify, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { getDrizzleDatabase } from "../db/client.js";
import {
  locations,
  tenants,
  walleePaymentProfiles,
  walleePaymentTerminals,
  walleeWebhookEvents
} from "../db/schema.js";
import type {
  LocalMasterPaymentConfig,
  LocalMasterWalleeTerminalPaymentRequest,
  LocalMasterWalleeTerminalPaymentResponse,
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

type WalleeTerminalGateway = {
  performTransaction(input: {
    profile: WalleeProfileRow;
    applicationUserSecret: string;
    terminal: WalleeTerminalRow;
    request: Required<Pick<LocalMasterWalleeTerminalPaymentRequest, "request_id" | "amount" | "currency">> & {
      lines: unknown[];
      table_context: unknown;
    };
  }): Promise<LocalMasterWalleeTerminalPaymentResponse>;
};

let gatewayOverride: WalleeTerminalGateway | null = null;

export function setWalleeTerminalGatewayForTests(gateway: WalleeTerminalGateway | null) {
  gatewayOverride = gateway;
}

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

  if (!existing && !input.applicationUserSecret) {
    throw new ApiError("Application user secret is required for a new wallee profile.");
  }

  const secret = input.applicationUserSecret ? encryptSecret(input.applicationUserSecret) : existing?.applicationUserSecretEncrypted;
  if (!secret) {
    throw new ApiError("Application user secret is required.");
  }

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
    ? await getDrizzleDatabase()
      .update(walleePaymentProfiles)
      .set(values)
      .where(eq(walleePaymentProfiles.id, existing.id))
      .returning()
    : await getDrizzleDatabase()
      .insert(walleePaymentProfiles)
      .values({
        id: "wallee_profile_" + randomUUID(),
        ...values,
        createdAt: now
      })
      .returning();

  return toPaymentProfile(rows[0]);
}

export async function listWalleePaymentTerminals(tenantId: string, locationId: string): Promise<WalleePaymentTerminal[]> {
  const profile = await requireProfile(tenantId, locationId);
  const rows = await getDrizzleDatabase()
    .select()
    .from(walleePaymentTerminals)
    .where(eq(walleePaymentTerminals.profileId, profile.id))
    .orderBy(asc(walleePaymentTerminals.displayName));

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
    if (input.isDefault) {
      await tx.update(walleePaymentTerminals).set({ isDefault: 0, updatedAt: now }).where(eq(walleePaymentTerminals.profileId, profile.id));
    }

    return tx
      .insert(walleePaymentTerminals)
      .values({
        id: "wallee_terminal_" + randomUUID(),
        profileId: profile.id,
        tenantId,
        locationId,
        displayName: input.displayName,
        terminalId: input.terminalId,
        terminalIdentifier: input.terminalIdentifier,
        isDefault: input.isDefault ? 1 : 0,
        isActive: input.isActive ? 1 : 0,
        createdAt: now,
        updatedAt: now
      })
      .returning();
  });

  return toPaymentTerminal(rows[0]);
}

export async function updateWalleePaymentTerminal(
  tenantId: string,
  locationId: string,
  terminalId: string,
  request: WalleePaymentTerminalUpdateRequest
): Promise<WalleePaymentTerminal> {
  const current = await requireTerminal(tenantId, locationId, terminalId);
  const input = normalizeTerminalInput({
    display_name: request.display_name ?? current.displayName,
    terminal_id: request.terminal_id ?? current.terminalId,
    terminal_identifier: request.terminal_identifier ?? current.terminalIdentifier,
    is_default: request.is_default ?? current.isDefault === 1,
    is_active: request.is_active ?? current.isActive === 1
  });
  const now = new Date();
  const rows = await getDrizzleDatabase().transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(walleePaymentTerminals).set({ isDefault: 0, updatedAt: now }).where(eq(walleePaymentTerminals.profileId, current.profileId));
    }

    return tx
      .update(walleePaymentTerminals)
      .set({
        displayName: input.displayName,
        terminalId: input.terminalId,
        terminalIdentifier: input.terminalIdentifier,
        isDefault: input.isDefault ? 1 : 0,
        isActive: input.isActive ? 1 : 0,
        updatedAt: now
      })
      .where(eq(walleePaymentTerminals.id, terminalId))
      .returning();
  });

  return toPaymentTerminal(rows[0]);
}

export async function deleteWalleePaymentTerminal(tenantId: string, locationId: string, terminalId: string): Promise<void> {
  await requireTerminal(tenantId, locationId, terminalId);
  await getDrizzleDatabase().delete(walleePaymentTerminals).where(eq(walleePaymentTerminals.id, terminalId));
}

export async function getLocalMasterPaymentConfig(relayToken: string): Promise<LocalMasterPaymentConfig> {
  const credential = await requireLocalMasterCredential(relayToken);
  const profile = await getProfileRow(credential.tenantId, credential.locationId);
  if (!profile || profile.enabled !== 1) {
    return { wallee: null };
  }

  const terminals = await getActiveTerminalRows(profile.id);
  return {
    wallee: {
      enabled: true,
      mode: "CLOUD_TILL_LONG_POLLING",
      profile_id: profile.id,
      space_id: profile.spaceId,
      terminals: terminals.map(toPaymentTerminal)
    }
  };
}

export async function startLocalMasterWalleeTerminalPayment(
  relayToken: string,
  request: LocalMasterWalleeTerminalPaymentRequest
): Promise<LocalMasterWalleeTerminalPaymentResponse> {
  const credential = await requireLocalMasterCredential(relayToken);
  const profile = await requireEnabledProfile(credential.tenantId, credential.locationId);
  const paymentRequest = normalizePaymentRequest(request);
  const terminal = await selectTerminal(profile.id, paymentRequest.terminal_id);
  const applicationUserSecret = decryptSecret(profile.applicationUserSecretEncrypted);

  return getGateway().performTransaction({
    profile,
    applicationUserSecret,
    terminal,
    request: {
      request_id: paymentRequest.request_id,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      lines: paymentRequest.lines,
      table_context: paymentRequest.table_context
    }
  });
}

export async function acceptWalleeWebhook(profileId: string, payload: unknown, signature: string | undefined) {
  const profile = await requireProfileById(profileId);
  const event = normalizeWebhookPayload(payload);
  verifyWebhookSignature(profile, payload, signature);
  const now = new Date();

  try {
    const rows = await getDrizzleDatabase()
      .insert(walleeWebhookEvents)
      .values({
        id: "wallee_webhook_" + randomUUID(),
        profileId,
        eventId: event.eventId,
        entityId: event.entityId,
        listenerEntityId: event.listenerEntityId,
        listenerEntityTechnicalName: event.listenerEntityTechnicalName,
        payloadJson: payload,
        signature: signature ?? null,
        status: "accepted",
        processedAt: now,
        error: null,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return { accepted: true, duplicate: false, event_id: rows[0].eventId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { accepted: true, duplicate: true, event_id: event.eventId };
    }

    throw error;
  }
}

async function requireTenant(tenantId: string) {
  const rows = await getDrizzleDatabase().select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!rows[0]) throw new ApiError("Tenant not found.", 404);
}

async function requireLocation(tenantId: string, locationId: string) {
  await requireTenant(tenantId);
  const rows = await getDrizzleDatabase()
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1);
  if (!rows[0]) throw new ApiError("Location not found.", 404);
}

async function getProfileRow(tenantId: string, locationId: string) {
  return (await getDrizzleDatabase()
    .select()
    .from(walleePaymentProfiles)
    .where(and(eq(walleePaymentProfiles.tenantId, tenantId), eq(walleePaymentProfiles.locationId, locationId)))
    .limit(1))[0] ?? null;
}

async function requireProfile(tenantId: string, locationId: string) {
  await requireLocation(tenantId, locationId);
  const profile = await getProfileRow(tenantId, locationId);
  if (!profile) throw new ApiError("Wallee profile is not configured for this location.", 404);
  return profile;
}

async function requireEnabledProfile(tenantId: string, locationId: string) {
  const profile = await requireProfile(tenantId, locationId);
  if (profile.enabled !== 1) throw new ApiError("Wallee profile is disabled.", 409);
  return profile;
}

async function requireProfileById(profileId: string) {
  const profile = (await getDrizzleDatabase().select().from(walleePaymentProfiles).where(eq(walleePaymentProfiles.id, profileId)).limit(1))[0];
  if (!profile) throw new ApiError("Wallee profile not found.", 404);
  return profile;
}

async function getActiveTerminalRows(profileId: string) {
  return getDrizzleDatabase()
    .select()
    .from(walleePaymentTerminals)
    .where(and(eq(walleePaymentTerminals.profileId, profileId), eq(walleePaymentTerminals.isActive, 1)))
    .orderBy(asc(walleePaymentTerminals.displayName));
}

async function requireTerminal(tenantId: string, locationId: string, terminalId: string) {
  const row = (await getDrizzleDatabase()
    .select()
    .from(walleePaymentTerminals)
    .where(and(
      eq(walleePaymentTerminals.id, terminalId),
      eq(walleePaymentTerminals.tenantId, tenantId),
      eq(walleePaymentTerminals.locationId, locationId)
    ))
    .limit(1))[0];
  if (!row) throw new ApiError("Wallee terminal not found.", 404);
  return row;
}

async function selectTerminal(profileId: string, terminalReference: string | null) {
  const rows = await getActiveTerminalRows(profileId);
  const terminal = terminalReference
    ? rows.find((row) => row.id === terminalReference || row.terminalId === terminalReference || row.terminalIdentifier === terminalReference)
    : rows.find((row) => row.isDefault === 1) ?? rows[0];

  const fallbackTerminal = rows.find((row) => row.isDefault === 1) ?? rows[0];
  if (!terminal && terminalReference && fallbackTerminal) {
    return fallbackTerminal;
  }

  if (!terminal) throw new ApiError("No active wallee terminal is configured.", 409);
  return terminal;
}

function normalizeProfileInput(request: WalleePaymentProfileUpsertRequest) {
  return {
    spaceId: normalizeRequiredText(request.space_id, "Wallee space_id is required."),
    applicationUserId: normalizeRequiredText(request.application_user_id, "Wallee application_user_id is required."),
    applicationUserSecret: normalizeOptionalText(request.application_user_secret),
    webhookSignatureKey: normalizeOptionalText(request.webhook_signature_key),
    enabled: request.enabled ?? true
  };
}

function normalizeTerminalInput(request: WalleePaymentTerminalCreateRequest): {
  displayName: string;
  terminalId: string | null;
  terminalIdentifier: string | null;
  isDefault: boolean;
  isActive: boolean;
} {
  const terminalId = normalizeOptionalText(request.terminal_id);
  const terminalIdentifier = normalizeOptionalText(request.terminal_identifier);
  if (!terminalId && !terminalIdentifier) {
    throw new ApiError("Terminal ID or terminal identifier is required.");
  }

  return {
    displayName: normalizeRequiredText(request.display_name, "Terminal display name is required."),
    terminalId,
    terminalIdentifier,
    isDefault: request.is_default ?? false,
    isActive: request.is_active ?? true
  };
}

function normalizePaymentRequest(request: LocalMasterWalleeTerminalPaymentRequest) {
  const amount = Number(request.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError("Payment amount must be a positive integer in minor units.");
  }

  return {
    request_id: normalizeRequiredText(request.request_id, "Payment request_id is required."),
    amount,
    currency: normalizeOptionalText(request.currency) ?? "CHF",
    terminal_id: normalizeOptionalText(request.terminal_id),
    lines: Array.isArray(request.lines) ? request.lines : [],
    table_context: request.table_context ?? null
  };
}

function normalizeWebhookPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ApiError("Webhook payload must be a JSON object.");
  }

  const eventId = normalizeOptionalText((payload as { eventId?: unknown }).eventId);
  if (!eventId) {
    throw new ApiError("Webhook eventId is required.");
  }

  return {
    eventId,
    entityId: normalizeOptionalText((payload as { entityId?: unknown }).entityId),
    listenerEntityId: normalizeOptionalText((payload as { listenerEntityId?: unknown }).listenerEntityId),
    listenerEntityTechnicalName: normalizeOptionalText((payload as { listenerEntityTechnicalName?: unknown }).listenerEntityTechnicalName)
  };
}

function normalizeRequiredText(value: unknown, message: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new ApiError(message);
  return normalized;
}

function normalizeOptionalText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function toPaymentProfile(row: WalleeProfileRow): WalleePaymentProfile {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    location_id: row.locationId,
    space_id: row.spaceId,
    application_user_id: row.applicationUserId,
    has_application_user_secret: Boolean(row.applicationUserSecretEncrypted),
    has_webhook_signature_key: Boolean(row.webhookSignatureKey),
    mode: "CLOUD_TILL_LONG_POLLING",
    enabled: row.enabled === 1,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}

function toPaymentTerminal(row: WalleeTerminalRow): WalleePaymentTerminal {
  return {
    id: row.id,
    profile_id: row.profileId,
    tenant_id: row.tenantId,
    location_id: row.locationId,
    display_name: row.displayName,
    terminal_id: row.terminalId,
    terminal_identifier: row.terminalIdentifier,
    is_default: row.isDefault === 1,
    is_active: row.isActive === 1,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  };
}

function encryptSecret(secret: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(encryptedSecret: string) {
  const [version, ivText, tagText, encryptedText] = encryptedSecret.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new ApiError("Stored wallee secret cannot be decrypted.", 500);
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function getEncryptionKey() {
  const source = process.env.WALLEE_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!source) {
    throw new ApiError("WALLEE_CREDENTIAL_ENCRYPTION_KEY is required to store or use wallee credentials.", 500);
  }

  return createHash("sha256").update(source).digest();
}

function verifyWebhookSignature(profile: WalleeProfileRow, payload: unknown, signature: string | undefined) {
  if (!profile.webhookSignatureKey) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("Wallee webhook signature key is not configured.", 500);
    }
    return;
  }

  if (!signature) {
    throw new ApiError("Wallee webhook signature is required.", 401);
  }

  if (profile.webhookSignatureKey.includes("BEGIN PUBLIC KEY")) {
    const parsedSignature = parseWalleeSignature(signature);
    const verifier = createVerify("sha256");
    verifier.update(JSON.stringify(payload));
    verifier.end();

    if (!verifier.verify(profile.webhookSignatureKey, Buffer.from(parsedSignature, "base64"))) {
      throw new ApiError("Invalid wallee webhook signature.", 401);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new ApiError("Wallee webhook signature key must be a public key in production.", 500);
  }

  const expected = createHmac("sha256", profile.webhookSignatureKey).update(JSON.stringify(payload)).digest("hex");
  const actual = signature.replace(/^sha256=/i, "");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new ApiError("Invalid wallee webhook signature.", 401);
  }
}

function parseWalleeSignature(signatureHeader: string) {
  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, value]) => key && value)
  );

  return parts.signature ?? signatureHeader;
}

function getGateway(): WalleeTerminalGateway {
  return gatewayOverride ?? new HttpWalleeTerminalGateway();
}

function getWalleeApiBaseUrl() {
  const configured = (process.env.WALLEE_API_BASE_URL ?? "https://app-wallee.com/api/v2.0").replace(/\/$/, "");
  if (configured.endsWith("/api")) {
    return configured + "/v2.0";
  }

  return configured;
}

function getWalleeRequestTimeoutMs() {
  const configured = Number.parseInt(process.env.WALLEE_CLOUD_TILL_REQUEST_TIMEOUT_MS ?? "95000", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 95000;
}

function getTerminalTransactionEndpoints(terminal: WalleeTerminalRow, transactionId: string) {
  const transactionQuery = "?transactionId=" + encodeURIComponent(transactionId);
  const endpoints: Array<{ kind: "id" | "identifier"; path: string }> = [];

  if (terminal.terminalId) {
    endpoints.push({
      kind: "id",
      path: "/payment/terminals/" + encodeURIComponent(terminal.terminalId) + "/perform-transaction" + transactionQuery
    });
  }

  if (terminal.terminalIdentifier) {
    endpoints.push({
      kind: "identifier",
      path: "/payment/terminals/by-identifier/" + encodeURIComponent(terminal.terminalIdentifier) + "/perform-transaction" + transactionQuery
    });
  }

  return endpoints;
}

function isWalleeMissingTerminalError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('"code":"resource_missing"') || error.message.includes("The requested terminal does not exist.");
}

class HttpWalleeTerminalGateway implements WalleeTerminalGateway {
  async performTransaction(input: Parameters<WalleeTerminalGateway["performTransaction"]>[0]): Promise<LocalMasterWalleeTerminalPaymentResponse> {
    if (process.env.WALLEE_CLOUD_TILL_SIMULATOR === "1") {
      return {
        provider: "WALLEE_CLOUD_TILL",
        provider_transaction_id: "wallee_cloud_sim_" + input.request.request_id,
        provider_status: "AUTHORIZED",
        authorized: true,
        failure_reason: null
      };
    }

    const apiBaseUrl = getWalleeApiBaseUrl();
    const transaction = await this.postJson<{ id?: number | string; state?: string }>(
      apiBaseUrl + "/payment/transactions",
      input,
      {
        currency: input.request.currency,
        lineItems: [{
          uniqueId: "easytable-" + input.request.request_id,
          type: "PRODUCT",
          name: "EasyTable POS",
          quantity: 1,
          amountIncludingTax: input.request.amount / 100
        }],
        merchantReference: input.request.request_id
      },
      { headers: { Space: input.profile.spaceId } }
    );
    const transactionId = String(transaction.id ?? "");
    if (!transactionId) {
      throw new ApiError("Wallee transaction response did not include an id.", 502);
    }

    const result = await this.performTerminalTransaction(apiBaseUrl, input, transactionId);

    const providerStatus = mapWalleeState(result.transaction?.state ?? result.state ?? transaction.state);
    return {
      provider: "WALLEE_CLOUD_TILL",
      provider_transaction_id: transactionId,
      provider_status: providerStatus,
      authorized: providerStatus === "AUTHORIZED",
      failure_reason: providerStatus === "AUTHORIZED" ? null : "Wallee terminal returned " + providerStatus + "."
    };
  }

  private async performTerminalTransaction(
    apiBaseUrl: string,
    input: Parameters<WalleeTerminalGateway["performTransaction"]>[0],
    transactionId: string
  ) {
    const endpoints = getTerminalTransactionEndpoints(input.terminal, transactionId);
    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        return await this.pollTerminalTransaction(apiBaseUrl, input, endpoint);
      } catch (error) {
        lastError = error;
        if (!isWalleeMissingTerminalError(error) || endpoint.kind !== "id") {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async pollTerminalTransaction(
    apiBaseUrl: string,
    input: Parameters<WalleeTerminalGateway["performTransaction"]>[0],
    endpoint: { path: string }
  ) {
    const maxAttempts = Math.max(1, Number.parseInt(process.env.WALLEE_CLOUD_TILL_LONG_POLL_ATTEMPTS ?? "10", 10));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await this.postJson<{ state?: string; transaction?: { state?: string } }>(
        apiBaseUrl + endpoint.path,
        input,
        {},
        { headers: { Space: input.profile.spaceId }, retryOnLongPollTimeout: true }
      );

      const rawState = result.transaction?.state ?? result.state;
      if (rawState?.toUpperCase() !== "PENDING") {
        return result;
      }
    }

    return { state: "TIMEOUT" };
  }

  private async postJson<T>(
    url: string,
    input: Parameters<WalleeTerminalGateway["performTransaction"]>[0],
    body: unknown,
    options: { headers?: Record<string, string>; retryOnLongPollTimeout?: boolean } = {}
  ): Promise<T> {
    const timeout = getWalleeRequestTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": createWalleeAuthorizationHeader(url, "POST", input.profile.applicationUserId, input.applicationUserSecret),
          "Content-Type": "application/json",
          ...options.headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Wallee API request timed out at " + new URL(url).pathname + ".", 502);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 543 && options.retryOnLongPollTimeout) {
        return { state: "PENDING" } as T;
      }

      const message = await response.text().catch(() => "");
      throw new ApiError(formatWalleeApiError(response.status, url, message), 502);
    }

    return (await response.json()) as T;
  }
}

function createWalleeAuthorizationHeader(url: string, method: "POST", applicationUserId: string, authenticationKey: string) {
  const parsed = new URL(url);
  const requestPath = parsed.pathname + parsed.search;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT", ver: 1 }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: applicationUserId,
    iat: Math.trunc(Date.now() / 1000),
    requestPath,
    requestMethod: method
  }));
  const signingInput = header + "." + payload;
  const signature = createHmac("sha256", Buffer.from(authenticationKey, "base64")).update(signingInput).digest("base64url");

  return "Bearer " + signingInput + "." + signature;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function formatWalleeApiError(status: number, url: string, message: string) {
  const path = new URL(url).pathname;
  const trimmed = message.trim();
  if (!trimmed) {
    return "Wallee API request failed with HTTP " + status + " at " + path + ".";
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
    return "Wallee API request failed with HTTP " + status + " at " + path + ".";
  }

  return trimmed;
}

function mapWalleeState(value: string | undefined): LocalMasterWalleeTerminalPaymentResponse["provider_status"] {
  const state = value?.toUpperCase() ?? "";
  if (state === "AUTHORIZED" || state === "COMPLETED" || state === "FULFILL") return "AUTHORIZED";
  if (state === "DECLINE" || state === "DECLINED" || state === "FAILED") return "DECLINED";
  if (state === "VOIDED" || state === "CANCELED" || state === "CANCELLED") return "CANCELLED";
  if (state === "TIMEOUT") return "TIMEOUT";
  return "UNKNOWN";
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && (error as { code?: string }).code === "23505") {
    return true;
  }

  return "cause" in error && isUniqueViolation((error as { cause?: unknown }).cause);
}
