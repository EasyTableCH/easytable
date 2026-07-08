import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFullStornoRequest,
  buildPartialStornoRequest,
  calculatePartialStornoTotal
} from "./stornoModel.js";
import type { OrderSnapshotResponse } from "../../lib/pos-types.js";

const snapshot: OrderSnapshotResponse = {
  id: "snap_order_1",
  order_id: "order_1",
  order_number: "POS-1",
  snapshot_type: "PAID",
  table_context: null,
  lines: [{
    id: "line_1",
    product_id: "prod_1",
    product_type: "BASIC",
    product_name: "Espresso",
    product_category: "Bar",
    base_price: 400,
    tax_code_id: "tax",
    tax_code_name: "Normal",
    tax_rate_bps: 810,
    station: "Bar",
    variants: [],
    unit_total: 400,
    quantity: 2,
    line_total: 800
  }, {
    id: "line_2",
    product_id: "prod_2",
    product_type: "BASIC",
    product_name: "Wasser",
    product_category: "Bar",
    base_price: 300,
    tax_code_id: "tax",
    tax_code_name: "Normal",
    tax_rate_bps: 810,
    station: "Bar",
    variants: [],
    unit_total: 300,
    quantity: 1,
    line_total: 300
  }],
  subtotal: 1100,
  tax_total: 82,
  total: 1100,
  payment: {
    payment_id: "pay_1",
    request_id: "pay_req_1",
    method: "CASH",
    amount: 1100,
    terminal_id: "terminal_1",
    provider: "LOCAL",
    provider_transaction_id: null,
    provider_status: "LOCAL_COMPLETED",
    lifecycle_state: "completed",
    paid_at: 1
  },
  terminal_id: "terminal_1",
  business_date: "2026-07-08",
  created_at: 1,
  refunded_total: 0,
  remaining_total: 1100
};

test("buildFullStornoRequest creates required LocalMaster payload", () => {
  assert.deepEqual(buildFullStornoRequest({
    snapshot,
    reason: " Kunde falsch bestellt ",
    requestId: "storno_full_1",
    terminalId: "terminal_1"
  }), {
    request_id: "storno_full_1",
    kind: "FULL",
    reason: "Kunde falsch bestellt",
    terminal_id: "terminal_1"
  });
});

test("buildPartialStornoRequest creates selected line payload", () => {
  assert.deepEqual(buildPartialStornoRequest({
    snapshot,
    selectedQuantities: { line_1: 1, line_2: 0 },
    reason: "Teil retour",
    requestId: "storno_part_1",
    terminalId: "terminal_1"
  }), {
    request_id: "storno_part_1",
    kind: "PARTIAL",
    reason: "Teil retour",
    terminal_id: "terminal_1",
    lines: [{ line_id: "line_1", quantity: 1 }]
  });
});

test("partial storno rejects invalid selections", () => {
  assert.throws(() => buildPartialStornoRequest({
    snapshot,
    selectedQuantities: {},
    reason: "Teil retour",
    requestId: "storno_part_empty"
  }), /Mindestens eine Position/);
  assert.throws(() => buildPartialStornoRequest({
    snapshot,
    selectedQuantities: { line_1: 0 },
    reason: "",
    requestId: "storno_part_reason"
  }), /Grund/);
  assert.throws(() => buildPartialStornoRequest({
    snapshot,
    selectedQuantities: { line_missing: 1 },
    reason: "Teil retour",
    requestId: "storno_part_unknown"
  }), /Unbekannte/);
  assert.throws(() => buildPartialStornoRequest({
    snapshot,
    selectedQuantities: { line_2: 2 },
    reason: "Teil retour",
    requestId: "storno_part_over_quantity"
  }), /hoeher als die verkaufte Menge/);
});

test("partial storno rejects over amount and calculates selected total", () => {
  const mostlyRefunded = { ...snapshot, remaining_total: 350 };
  assert.equal(calculatePartialStornoTotal(snapshot, { line_1: 1, line_2: 1 }), 700);
  assert.throws(() => buildPartialStornoRequest({
    snapshot: mostlyRefunded,
    selectedQuantities: { line_1: 1 },
    reason: "Teil retour",
    requestId: "storno_part_over_amount"
  }), /Restbetrag/);
});
