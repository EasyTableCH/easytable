export type StaffProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable?: boolean;
};

export type StaffTable = {
  id: string;
  name: string;
  status?: "FREE" | "OPEN" | "PAID" | string;
  areaName?: string;
};

export type DraftItem = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type OrderDraft = {
  source: "STAFF";
  deviceId: string;
  tableId: string;
  guestCount: number;
  items: DraftItem[];
};

export type RealtimeEvent = {
  id?: string;
  type: string;
  createdAt?: number;
  payload?: unknown;
};

const configuredUrl = import.meta.env.VITE_LOCAL_REALTIME_URL as string | undefined;

export function getLocalRealtimeUrl() {
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

export function getRealtimeWsUrl() {
  const apiUrl = new URL(getLocalRealtimeUrl());
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/realtime";
  return apiUrl.toString();
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  const response = await fetch(`${getLocalRealtimeUrl()}${path}`);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;

  if (Array.isArray(payload)) {
    return payload as T;
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return (payload as T) ?? fallback;
}

export function loadCatalog() {
  return readJson<StaffProduct[]>("/api/catalog", []);
}

export function loadTables() {
  return readJson<StaffTable[]>("/api/tables", []);
}

export async function submitOrder(draft: OrderDraft) {
  const response = await fetch(`${getLocalRealtimeUrl()}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as unknown;
}
