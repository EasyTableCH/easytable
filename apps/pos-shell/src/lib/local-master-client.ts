import type {
  BasketLine,
  CompletedMockPayment,
  DayClosePreview,
  CreatedOrderSnapshot,
  LocalMasterIdentity,
  MockPaymentRequest,
  PosSettingsFile,
  OpenTableOrderBasket,
  PairingSession,
  PosProduct,
  ProductVariantGroup,
  SavedDayClose,
  TableContext,
  TableLayout,
  TerminalPairingConfig,
  TerminalRecord,
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
      }
    } catch {
      localMasterBlockedReason = null;
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

async function writeJsonFrom<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(normalizeBaseUrl(baseUrl) + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || String(response.status) + " " + response.statusText);
  }

  return (await response.json()) as T;
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

export function createOrderSnapshot(request: {
  lines: BasketLine[];
  table_context: TableContext;
}) {
  return writeJson<CreatedOrderSnapshot>("/api/order-snapshots", { request });
}

export function completeMockPayment(
  request: {
    lines: BasketLine[];
    table_context: TableContext;
  } & MockPaymentRequest,
) {
  return writeJson<CompletedMockPayment>("/api/mock-payments/complete", { request });
}

export function loadPosSettings() {
  return readJson<PosSettingsFile>("/api/pos-settings");
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

export function saveDayClose(request: {
  business_date: string;
  business_day_cutover_time: string;
  counted_cash: number;
}) {
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
