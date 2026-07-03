import { loadLocalSiteConfig } from "./localSiteStore.js";
import { areas, floors, layoutTables } from "./storeSeeds.js";
import { posOrders, staffOrders } from "./storeState.js";
import type { PosOrderSnapshot } from "./storeState.js";
import type { Order, Table, TableContext, TableLayout, TableLayoutTable } from "../types.js";

type OpenTableOrderSummary = {
  id: string;
  orderNumber: string;
  total: number;
};

export function listTables(): Table[] {
  return layoutTables.map((table) => {
    const area = areas.find((entry) => entry.id === table.area_id);
    const openOrder = findOpenOrderForTable(table.id);

    return {
      id: table.id,
      name: table.name,
      status: openOrder ? "OPEN" : "FREE",
      areaName: area?.name ?? ""
    };
  });
}

export function getTableLayout(): TableLayout {
  const siteConfig = loadLocalSiteConfig();

  return {
    tenant: siteConfig.tenant,
    location: siteConfig.location,
    floors: floors
      .slice()
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
      .map((floor) => ({
        ...floor,
        location_id: siteConfig.location.id,
        areas: areas
          .filter((area) => area.floor_id === floor.id)
          .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
          .map((area) => ({
            ...area,
            tables: layoutTables
              .filter((table) => table.area_id === area.id)
              .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
              .map(toLayoutTable)
          }))
      }))
  };
}

export function findOpenPosOrderForTable(tableId: string, locationId?: string): PosOrderSnapshot | undefined {
  return posOrders.find(
    (order) =>
      order.table_context !== null &&
      order.table_context.table_id === tableId &&
      (!locationId || order.table_context.location_id === locationId) &&
      order.status === "OPEN" &&
      order.payment_status === "UNPAID"
  );
}

export function findOpenStaffOrderForTable(tableId: string, locationId?: string): Order | undefined {
  const expectedLocationId = locationId ?? locationIdForTable(tableId);

  return staffOrders.find(
    (order) =>
      order.tableId === tableId &&
      order.status === "OPEN" &&
      (!expectedLocationId || (order.locationId ?? locationIdForTable(order.tableId)) === expectedLocationId)
  );
}

export function tableFromContext(tableContext: TableContext, status: Table["status"]): Table {
  return {
    id: tableContext.table_id,
    name: tableContext.table_name,
    status,
    areaName: tableContext.area_name ?? ""
  };
}

function toLayoutTable(
  table: Omit<TableLayoutTable, "open_order_id" | "open_order_number" | "open_total" | "open_order_count">
): TableLayoutTable {
  const openOrder = findOpenOrderForTable(table.id);

  return {
    ...table,
    open_order_id: openOrder?.id ?? null,
    open_order_number: openOrder?.orderNumber ?? null,
    open_total: openOrder?.total ?? 0,
    open_order_count: openOrder ? 1 : 0
  };
}

function findOpenOrderForTable(tableId: string): OpenTableOrderSummary | null {
  const posOrder = findOpenPosOrderForTable(tableId);

  if (posOrder) {
    return {
      id: posOrder.id,
      orderNumber: posOrder.order_number,
      total: posOrder.total
    };
  }

  const staffOrder = findOpenStaffOrderForTable(tableId);

  if (!staffOrder) {
    return null;
  }

  return {
    id: staffOrder.id,
    orderNumber: staffOrder.orderNumber,
    total: staffOrder.total
  };
}

function locationIdForTable(tableId: string) {
  const table = layoutTables.find((entry) => entry.id === tableId);

  return table ? loadLocalSiteConfig().location.id : null;
}
