import { randomUUID } from "node:crypto";

import type { Order, OrderDraft, Product, Table } from "./types.js";

// Mirrors apps/pos-shell/src-tauri/src/seeds.rs until the manager reads SQLite directly.
const products: Product[] = [
  { id: "prod_invoice", name: "Rechnung", category: "Service", price: 0, isAvailable: true },
  { id: "prod_service_personal", name: "Service Personal", category: "Service", price: 0, isAvailable: true },
  { id: "prod_shisha_standard", name: "Shisha Standard", category: "Shisha", price: 3000, isAvailable: true },
  { id: "prod_nava_shisha", name: "NAVA Shisha", category: "Shisha", price: 5900, isAvailable: true },
  { id: "prod_smokezilla_laser_shisha", name: "SmokeZilla Laser Shisha", category: "Shisha", price: 8900, isAvailable: true },
  { id: "prod_shisha_triple_skull", name: "Shisha Triple Skull", category: "Shisha", price: 4500, isAvailable: true },
  { id: "prod_neuer_kopf", name: "Neuer Kopf", category: "Shisha", price: 1500, isAvailable: true },
  { id: "prod_kohle", name: "Kohle", category: "Shisha", price: 0, isAvailable: true },
  { id: "prod_mundstucke", name: "Mundstucke", category: "Shisha", price: 300, isAvailable: true },
  { id: "prod_chinotto", name: "Chinotto", category: "Sussgetranke", price: 700, isAvailable: true }
];

const tables: Table[] = [
  { id: "table_basilica_bar_1", name: "1", status: "FREE", areaName: "Bar" },
  { id: "table_basilica_fumoir_2", name: "2", status: "FREE", areaName: "Fumoir" },
  { id: "table_basilica_fumoir_3", name: "3", status: "FREE", areaName: "Fumoir" },
  { id: "table_basilica_lounges_10", name: "10", status: "FREE", areaName: "Lounges" },
  { id: "table_basilica_raucherlounge_20", name: "20", status: "FREE", areaName: "Raucherlounge" },
  { id: "table_basilica_og_30", name: "30", status: "FREE", areaName: "Lounge" }
];

const orders: Order[] = [];

export type CreateOrderResult = {
  order: Order;
  table: Table;
};

export function listProducts() {
  return products;
}

export function listTables() {
  return tables;
}

export function listOpenOrders() {
  return orders;
}

export function createOrder(draft: OrderDraft): CreateOrderResult {
  const table = tables.find((entry) => entry.id === draft.tableId);

  if (!table) {
    throw new Error("Unknown table");
  }

  const items = draft.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);

    if (!product || !product.isAvailable) {
      throw new Error(`Unavailable product: ${item.productId}`);
    }

    return {
      ...item,
      productName: product.name,
      unitPrice: product.price,
      totalPrice: product.price * item.quantity
    };
  });

  const order: Order = {
    id: randomUUID(),
    orderNumber: `L-${String(orders.length + 1).padStart(4, "0")}`,
    source: "STAFF",
    deviceId: draft.deviceId,
    tableId: table.id,
    tableName: table.name,
    guestCount: draft.guestCount,
    status: "OPEN",
    total: items.reduce((sum, item) => sum + item.totalPrice, 0),
    items,
    createdAt: Date.now()
  };

  orders.push(order);
  table.status = "OPEN";

  return { order, table };
}
