export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
};

export type TableStatus = "FREE" | "OPEN";

export type Table = {
  id: string;
  name: string;
  status: TableStatus;
  areaName: string;
};

export type OrderDraftItem = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type OrderDraft = {
  source: "STAFF";
  deviceId: string;
  tableId: string;
  guestCount: number;
  items: OrderDraftItem[];
};

export type OrderItem = OrderDraftItem & {
  productName: string;
  unitPrice: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  source: "STAFF";
  deviceId: string;
  tableId: string;
  tableName: string;
  guestCount: number;
  status: "OPEN";
  total: number;
  items: OrderItem[];
  createdAt: number;
};

export type RealtimeEventType =
  | "CONNECTED"
  | "DEVICE_CONNECTED"
  | "DEVICE_DISCONNECTED"
  | "INVALID_MESSAGE"
  | "ORDER_CREATED"
  | "TABLE_UPDATED";

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  createdAt: number;
  payload: unknown;
};
