import type {
  BasketLine,
  CatalogOutputStation,
  CloudBinding,
  PaymentResult,
  PaymentAttemptStatus,
  CreateOrderStornoRequest,
  CreateOrderSnapshotRequest,
  DayClosePreview,
  CreatedOrderSnapshot,
  LocalDevice,
  LocalDeviceInput,
  LocalMasterIdentity,
  LocalPosSession,
  LocalPosUser,
  PaymentRequest,
  OrderSnapshotListItem,
  OrderSnapshotResponse,
  PosDeviceBinding,
  PosDeviceBindingUpdateRequest,
  PosSettingsFile,
  PrintJob,
  PrintLog,
  OpenTableOrderBasket,
  PairingSession,
  PosProduct,
  ProductVariantGroup,
  SavedDayClose,
  SaveDayCloseRequest,
  StationDeviceBinding,
  StationDeviceBindingUpdateRequest,
  TableContext,
  TableLayout,
  TerminalPairingConfig,
  TerminalRecord,
  StornoResult,
  WalleeTerminalPaymentRequest,
  ComplimentaryOrderResult,
} from "./pos-types";

export type LocalMasterEvent = {
  id?: string;
  type: string;
  createdAt?: number;
  payload?: unknown;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const terminalConfigStorageKey = "easytable.pos.terminalConfig";
const posSessionStorageKey = "easytable.pos.local-session";
const posClientApiVersion = 1;
const configuredUrl =
  (import.meta.env.VITE_LOCAL_MASTER_URL as string | undefined) ??
  (import.meta.env.VITE_LOCAL_REALTIME_URL as string | undefined);

let runtimeTerminalConfig: TerminalPairingConfig | null = readLocalStorageTerminalConfig();
let localMasterBlockedReason: string | null = null;

export async function initializeLocalMasterClient() {
  const storedConfig = await loadTerminalConfig();

  if (storedConfig) {
    runtimeTerminalConfig = storedConfig;

    try {
      const identity = await loadLocalMasterIdentity(storedConfig.localMasterUrl);

      if (identity.instance_id !== storedConfig.localMasterInstanceId) {
        localMasterBlockedReason = "Andere LocalMaster Instanz erkannt. Neu-Kopplung erforderlich.";
      } else if (posClientApiVersion < identity.minimum_client_api_version || posClientApiVersion > identity.maximum_client_api_version) {
        localMasterBlockedReason = "POS und LocalMaster Versionen sind nicht kompatibel. Update erforderlich.";
      } else {
        localMasterBlockedReason = null;
      }
    } catch {
      localMasterBlockedReason = "LocalMaster Identitaet konnte nicht verifiziert werden. Verbindung pruefen oder neu koppeln.";
    }
  }

  return runtimeTerminalConfig;
}

export function getStoredTerminalConfig() {
  return runtimeTerminalConfig;
}

export function getLocalMasterBlockedReason() {
  return localMasterBlockedReason;
}

export async function saveTerminalPairingConfig(config: TerminalPairingConfig) {
  runtimeTerminalConfig = config;
  localMasterBlockedReason = null;
  writeLocalStorageTerminalConfig(config);
  await saveTauriTerminalConfig(config);
}

export async function clearTerminalPairingConfig() {
  runtimeTerminalConfig = null;
  localMasterBlockedReason = null;
  window.localStorage.removeItem(terminalConfigStorageKey);
  await clearTauriTerminalConfig();
}

export function getLocalMasterUrl() {
  if (runtimeTerminalConfig?.localMasterUrl) {
    return normalizeBaseUrl(runtimeTerminalConfig.localMasterUrl);
  }

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (window.location.hostname && window.location.hostname !== "tauri.localhost") {
    return window.location.protocol + "//" + window.location.hostname + ":3000";
  }

  return "http://localhost:3000";
}

export function getLocalMasterWsUrl() {
  const apiUrl = new URL(getLocalMasterUrl());
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/realtime";
  apiUrl.search = "";
  apiUrl.hash = "";

  return apiUrl.toString();
}

export function getDefaultPairingUrl() {
  return getLocalMasterUrl();
}

export function loadLocalMasterIdentity(baseUrl = getLocalMasterUrl()) {
  return readJsonFrom<LocalMasterIdentity>(baseUrl, "/api/local-master/identity");
}

export function loadCloudBinding(baseUrl = getLocalMasterUrl()) {
  return readJsonFrom<CloudBinding>(baseUrl, "/api/local-master/cloud-binding");
}

export function pairCloudRelay(baseUrl: string, request: {
  relay_base_url: string;
  setup_code: string;
  local_master_url?: string | null;
}) {
  return writeJsonFrom<CloudBinding>(baseUrl, "/api/local-master/cloud-pair", { request });
}

export function retryCloudBootstrap(baseUrl = getLocalMasterUrl()) {
  return writeJsonFrom<CloudBinding>(baseUrl, "/api/local-master/cloud-bootstrap", { request: {} });
}

export function startPairingSession(request: { local_master_url?: string } = {}, baseUrl = getLocalMasterUrl()) {
  return writeJsonFrom<PairingSession>(baseUrl, "/api/local-master/pairing-sessions", { request });
}

export async function pairTerminal(baseUrl: string, request: {
  code: string;
  terminal_name: string;
  role?: "POS_TERMINAL" | "MASTER_POS";
  device_fingerprint?: string;
}) {
  const pairingConfig = await writeJsonFrom<TerminalPairingConfig>(baseUrl, "/api/local-master/pair", {
    request: {
      ...request,
      local_master_url: normalizeBaseUrl(baseUrl),
    },
  });

  await saveTerminalPairingConfig(pairingConfig);

  return pairingConfig;
}

export async function sendTerminalHeartbeat(config = runtimeTerminalConfig) {
  if (!config) {
    return null;
  }

  const terminal = await writeJsonFrom<TerminalRecord>(
    config.localMasterUrl,
    "/api/local-master/terminals/" + encodeURIComponent(config.terminalId) + "/heartbeat",
    { request: { terminal_secret: config.terminalSecret } },
  );
  const updatedConfig = { ...config, lastSeenAt: terminal.last_seen_at };

  await saveTerminalPairingConfig(updatedConfig);

  return terminal;
}

async function readJson<T>(path: string): Promise<T> {
  assertLocalMasterAllowed();
  return readJsonFrom<T>(getLocalMasterUrl(), path);
}

async function readJsonFrom<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(normalizeBaseUrl(baseUrl) + path);

  if (!response.ok) {
    throw new Error(String(response.status) + " " + response.statusText);
  }

  const payload = (await response.json()) as unknown;

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

async function writeJson<T>(path: string, body: unknown): Promise<T> {
  assertLocalMasterAllowed();
  return writeJsonFrom<T>(getLocalMasterUrl(), path, body);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  assertLocalMasterAllowed();
  return writeJsonFrom<T>(getLocalMasterUrl(), path, body, "PATCH");
}

async function writeJsonFrom<T>(baseUrl: string, path: string, body: unknown, method = "POST"): Promise<T> {
  const session = getStoredPosSession();
  const response = await fetch(normalizeBaseUrl(baseUrl) + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.token } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || String(response.status) + " " + response.statusText);
  }

  return (await response.json()) as T;
}

export function getStoredPosSession(): LocalPosSession | null {
  const raw = window.localStorage.getItem(posSessionStorageKey);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as LocalPosSession;
    return session.expires_at > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function loadStoredPosSession() {
  const session = getStoredPosSession();
  if (!session) return null;
  const response = await fetch(getLocalMasterUrl() + "/api/local-auth/session", { headers: { Authorization: "Bearer " + session.token } });
  if (!response.ok) {
    clearStoredPosSession();
    return null;
  }
  return await response.json() as LocalPosSession;
}

export function clearStoredPosSession() {
  window.localStorage.removeItem(posSessionStorageKey);
}

export async function loadLocalPosUsers() {
  const config = getStoredTerminalConfig();
  if (!config) throw new Error("POS ist noch nicht mit LocalMaster gekoppelt.");
  const response = await fetch(getLocalMasterUrl() + "/api/local-auth/users", { headers: {
    "x-easytable-device-id": config.terminalId,
    "x-easytable-device-secret": config.terminalSecret
  } });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as LocalPosUser[];
}

export async function loginLocalPos(userId: string, pin: string) {
  const config = getStoredTerminalConfig();
  if (!config) throw new Error("POS ist noch nicht mit LocalMaster gekoppelt.");
  const session = await writeJson<LocalPosSession>("/api/local-auth/pin", { request: {
    device_id: config.terminalId,
    device_secret: config.terminalSecret,
    user_id: userId,
    pin
  } });
  window.localStorage.setItem(posSessionStorageKey, JSON.stringify(session));
  return session;
}

export function loadTableLayout() {
  return readJson<TableLayout>("/api/table-layout");
}

export function loadProducts() {
  return readJson<PosProduct[]>("/api/products");
}

export function loadProductVariantGroups(productId: string) {
  return readJson<ProductVariantGroup[]>("/api/product-variant-groups/" + encodeURIComponent(productId));
}

export function loadOpenTableOrderBasket(tableId: string) {
  return readJson<OpenTableOrderBasket | null>(
    "/api/tables/" + encodeURIComponent(tableId) + "/open-basket",
  );
}

export function createOrderSnapshot(request: CreateOrderSnapshotRequest) {
  return writeJson<CreatedOrderSnapshot>("/api/order-snapshots", { request });
}

export function completeCashPayment(
  request: {
    lines: BasketLine[];
    table_context: TableContext | null;
  } & PaymentRequest,
) {
  return writeJson<PaymentResult>("/api/payments/cash/complete", { request });
}

export function startWalleeTerminalPayment(request: WalleeTerminalPaymentRequest) {
  return writeJson<PaymentResult>("/api/payments/wallee-terminal/start", { request });
}

export function completeComplimentaryOrder(request: {
  request_id: string;
  lines: BasketLine[];
  table_context: TableContext | null;
  terminal_id?: string;
}) {
  return writeJson<ComplimentaryOrderResult>("/api/orders/complimentary/complete", { request });
}

export function adjustComplimentaryQuantity(orderId: string, lineId: string, complimentaryQuantity: number) {
  return writeJson<OpenTableOrderBasket>(
    "/api/orders/" + encodeURIComponent(orderId) + "/complimentary",
    { request: {
      request_id: createClientRequestId("complimentary"),
      line_id: lineId,
      complimentary_quantity: complimentaryQuantity
    } }
  );
}

export function getPaymentAttempt(attemptId: string) {
  return readJson<PaymentAttemptStatus>("/api/payments/attempts/" + encodeURIComponent(attemptId));
}

export function reconcilePaymentAttempt(attemptId: string) {
  return writeJson<PaymentAttemptStatus>("/api/payments/attempts/" + encodeURIComponent(attemptId) + "/reconcile", { request: {} });
}

export function loadPosSettings() {
  return readJson<PosSettingsFile>("/api/pos-settings");
}

export function loadReportingOrderSnapshots(filters: {
  from?: string;
  to?: string;
  query?: string;
  payment_method?: string;
  terminal_id?: string;
  storno_state?: string;
} = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.toString() ? "?" + query.toString() : "";
  return readJson<OrderSnapshotListItem[]>("/api/reporting/order-snapshots" + suffix);
}

export function loadOrderSnapshot(orderId: string) {
  return readJson<OrderSnapshotResponse>("/api/orders/" + encodeURIComponent(orderId) + "/snapshot");
}

export function createOrderStorno(orderId: string, request: CreateOrderStornoRequest) {
  return writeJson<StornoResult>("/api/orders/" + encodeURIComponent(orderId) + "/stornos", { request });
}

export function loadOutputStations() {
  return readJson<CatalogOutputStation[]>("/api/catalog/output-stations");
}

export function loadLocalDevices() {
  return readJson<LocalDevice[]>("/api/local-devices");
}

export function createLocalDevice(request: LocalDeviceInput) {
  return writeJson<LocalDevice>("/api/local-devices", { request });
}

export function updateLocalDevice(deviceId: string, request: Partial<LocalDeviceInput>) {
  return patchJson<LocalDevice>("/api/local-devices/" + encodeURIComponent(deviceId), { request });
}

export function testLocalDevice(deviceId: string) {
  return writeJson<{ ok: true; message: string; print_log?: PrintLog }>("/api/local-devices/" + encodeURIComponent(deviceId) + "/test", { request: {} });
}

export function loadPrintLogs() {
  return readJson<PrintLog[]>("/api/print-logs");
}

export function loadPrintJobs() {
  return readJson<PrintJob[]>("/api/print-jobs");
}

export function retryPrintJob(jobId: string) {
  return writeJson<PrintJob>("/api/print-jobs/" + encodeURIComponent(jobId) + "/retry", {
    request: { request_id: createClientRequestId("print_retry") },
  });
}

export function clearPrintLogs() {
  return writeJson<{ ok: true }>("/api/print-logs/clear", { request: {} });
}

export function loadPosDeviceBinding(terminalId: string) {
  return readJson<PosDeviceBinding>("/api/pos-device-bindings/" + encodeURIComponent(terminalId));
}

export function updatePosDeviceBinding(terminalId: string, request: PosDeviceBindingUpdateRequest) {
  return writeJson<PosDeviceBinding>("/api/pos-device-bindings/" + encodeURIComponent(terminalId), { request });
}

export function loadStationDeviceBindings() {
  return readJson<StationDeviceBinding[]>("/api/station-device-bindings");
}

export function updateStationDeviceBinding(stationId: string, request: StationDeviceBindingUpdateRequest) {
  return writeJson<StationDeviceBinding>(
    "/api/station-device-bindings/" + encodeURIComponent(stationId),
    { request },
  );
}

export function loadCurrentBusinessDate(request: {
  business_day_cutover_time: string;
}) {
  return writeJson<{ business_date: string }>("/api/business-date/current", { request });
}

export function loadDayClosePreview(request: {
  business_date: string;
  business_day_cutover_time: string;
}) {
  return writeJson<DayClosePreview>("/api/day-close/preview", { request });
}

export function saveDayClose(request: SaveDayCloseRequest) {
  return writeJson<SavedDayClose>("/api/day-close", { request });
}

export function subscribeLocalMasterEvents(
  onEvent: (event: LocalMasterEvent) => void,
) {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let shouldReconnect = true;

  function connect() {
    socket = new WebSocket(getLocalMasterWsUrl());

    socket.addEventListener("open", () => {
      socket?.send(
        JSON.stringify({
          type: "HELLO",
          payload: {
            role: runtimeTerminalConfig?.terminalRole ?? "POS_SHELL",
            deviceId: runtimeTerminalConfig?.terminalId ?? "pos-shell",
            localMasterInstanceId: runtimeTerminalConfig?.localMasterInstanceId,
          },
        }),
      );
    });

    socket.addEventListener("message", (message) => {
      if (typeof message.data !== "string") {
        return;
      }

      try {
        onEvent(JSON.parse(message.data) as LocalMasterEvent);
      } catch (error) {
        console.warn("Could not parse Local Master realtime event.", error);
      }
    });

    socket.addEventListener("close", () => {
      if (shouldReconnect) {
        reconnectTimer = window.setTimeout(connect, 1_000);
      }
    });

    socket.addEventListener("error", () => {
      socket?.close();
    });
  }

  connect();

  return () => {
    shouldReconnect = false;

    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
    }

    socket?.close();
  };
}

async function loadTerminalConfig() {
  const tauriConfig = await loadTauriTerminalConfig();

  if (tauriConfig) {
    writeLocalStorageTerminalConfig(tauriConfig);
    return tauriConfig;
  }

  return readLocalStorageTerminalConfig();
}

async function invokeTauri<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI_INTERNALS__) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");

  return invoke<T>(command, args);
}

async function loadTauriTerminalConfig() {
  try {
    return await invokeTauri<TerminalPairingConfig | null>("load_terminal_config");
  } catch (error) {
    console.warn("Could not load Tauri terminal config.", error);
    return null;
  }
}

async function saveTauriTerminalConfig(config: TerminalPairingConfig) {
  try {
    await invokeTauri<void>("save_terminal_config", { config });
  } catch (error) {
    console.warn("Could not save Tauri terminal config.", error);
  }
}

async function clearTauriTerminalConfig() {
  try {
    await invokeTauri<void>("clear_terminal_config");
  } catch (error) {
    console.warn("Could not clear Tauri terminal config.", error);
  }
}

function assertLocalMasterAllowed() {
  if (localMasterBlockedReason) {
    throw new Error(localMasterBlockedReason);
  }
}

function readLocalStorageTerminalConfig() {
  try {
    const raw = window.localStorage.getItem(terminalConfigStorageKey);

    return raw ? (JSON.parse(raw) as TerminalPairingConfig) : null;
  } catch {
    return null;
  }
}

function writeLocalStorageTerminalConfig(config: TerminalPairingConfig) {
  window.localStorage.setItem(terminalConfigStorageKey, JSON.stringify(config));
}

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function createClientRequestId(prefix: string) {
  if (window.crypto?.randomUUID) {
    return prefix + "_" + window.crypto.randomUUID();
  }

  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}
