import type {
  BasketLine,
  CompletedMockPayment,
  DayClosePreview,
  CreatedOrderSnapshot,
  MockPaymentRequest,
  PosSettingsFile,
  OpenTableOrderBasket,
  PosProduct,
  ProductVariantGroup,
  SavedDayClose,
  TableContext,
  TableLayout,
} from "./pos-types";

export type LocalMasterEvent = {
  id?: string;
  type: string;
  createdAt?: number;
  payload?: unknown;
};

const configuredUrl =
  (import.meta.env.VITE_LOCAL_MASTER_URL as string | undefined) ??
  (import.meta.env.VITE_LOCAL_REALTIME_URL as string | undefined);

export function getLocalMasterUrl() {
  if (configuredUrl) {
    return configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;
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

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(getLocalMasterUrl() + path);

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
  const response = await fetch(getLocalMasterUrl() + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(String(response.status) + " " + response.statusText);
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
            role: "POS_SHELL",
            deviceId: "pos-shell",
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

