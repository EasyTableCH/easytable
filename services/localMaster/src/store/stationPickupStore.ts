import { persistStationPickups, stationPickups } from "./storeState.js";
import { scopedId } from "./storeHelpers.js";
import type { CreateStationPickupRequest, KdsTicket, StationPickup, StationPickupStatus } from "../types.js";

export function listStationPickups(status: StationPickupStatus | "ALL" = "READY") {
  return stationPickups
    .filter((pickup) => status === "ALL" || pickup.status === status)
    .slice()
    .sort((left, right) => left.ready_at - right.ready_at || left.station.localeCompare(right.station));
}

export function createStationPickup(request: CreateStationPickupRequest) {
  validateStationPickupRequest(request);

  const now = Date.now();
  const pickup: StationPickup = {
    id: scopedId("pickup", now, stationPickups.length),
    order_id: request.order_id?.trim() || scopedId("ord_external", now, stationPickups.length),
    order_number: request.order_number?.trim() || "READY-" + String(stationPickups.length + 1).padStart(4, "0"),
    table_id: request.table_id.trim(),
    table_name: request.table_name.trim(),
    station: request.station.trim(),
    status: "READY",
    items: request.items.map((item) => ({
      product_id: item.product_id.trim(),
      product_name: item.product_name.trim(),
      quantity: item.quantity,
      variants: item.variants.map((variant) => ({ ...variant }))
    })),
    ready_at: now,
    acknowledged_at: null
  };

  stationPickups.push(pickup);
  persistStationPickups();

  return pickup;
}

export function acknowledgeStationPickup(pickupId: string) {
  const pickup = stationPickups.find((entry) => entry.id === pickupId);

  if (!pickup) {
    throw new Error("Station pickup not found.");
  }

  if (pickup.status === "ACKNOWLEDGED") {
    return pickup;
  }

  pickup.status = "ACKNOWLEDGED";
  pickup.acknowledged_at = Date.now();
  persistStationPickups();

  return pickup;
}

export function createStationPickupFromKdsTicket(ticket: KdsTicket) {
  const existingReadyPickup = stationPickups.find(
    (pickup) => pickup.order_id === ticket.order_id && pickup.station === ticket.station && pickup.status === "READY"
  );

  if (existingReadyPickup) {
    return existingReadyPickup;
  }

  return createStationPickup({
    order_id: ticket.order_id,
    order_number: ticket.order_number,
    table_id: ticket.table_id,
    table_name: ticket.table_name,
    station: ticket.station,
    items: ticket.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      variants: item.variants.map((variant) => ({ ...variant }))
    }))
  });
}

function validateStationPickupRequest(request: CreateStationPickupRequest) {
  if (!request.table_id?.trim()) {
    throw new Error("Station pickup requires table_id.");
  }

  if (!request.table_name?.trim()) {
    throw new Error("Station pickup requires table_name.");
  }

  if (!request.station?.trim()) {
    throw new Error("Station pickup requires station.");
  }

  if (!Array.isArray(request.items) || request.items.length === 0) {
    throw new Error("Station pickup requires at least one item.");
  }

  for (const item of request.items) {
    if (!item.product_id?.trim() || !item.product_name?.trim()) {
      throw new Error("Station pickup items require product id and name.");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Station pickup items require a positive quantity.");
    }
  }
}
