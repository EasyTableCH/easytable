import type { CreateOrderStornoRequest, OrderSnapshotResponse } from "../../lib/pos-types";

export type PartialStornoSelection = Record<string, number>;

export function buildFullStornoRequest(input: {
  snapshot: OrderSnapshotResponse;
  reason: string;
  requestId: string;
  terminalId?: string | null;
}): CreateOrderStornoRequest {
  const reason = requireReason(input.reason);
  if (input.snapshot.remaining_total <= 0) {
    throw new Error("Diese Order hat keinen stornierbaren Betrag mehr.");
  }

  return {
    request_id: input.requestId,
    kind: "FULL",
    reason,
    terminal_id: input.terminalId ?? undefined
  };
}

export function buildPartialStornoRequest(input: {
  snapshot: OrderSnapshotResponse;
  selectedQuantities: PartialStornoSelection;
  reason: string;
  requestId: string;
  terminalId?: string | null;
}): CreateOrderStornoRequest {
  const reason = requireReason(input.reason);
  const lines = Object.entries(input.selectedQuantities)
    .filter(([, quantity]) => quantity !== 0)
    .map(([lineId, quantity]) => {
      const line = input.snapshot.lines.find((candidate) => candidate.id === lineId);
      if (!line) {
        throw new Error("Unbekannte Position.");
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Teil-Storno Menge muss positiv sein.");
      }
      if (quantity > line.quantity) {
        throw new Error("Teil-Storno Menge ist hoeher als die verkaufte Menge.");
      }
      const amount = quantity * line.unit_total;
      if (amount > input.snapshot.remaining_total) {
        throw new Error("Teil-Storno Betrag ist hoeher als der stornierbare Restbetrag.");
      }
      return { line_id: lineId, quantity };
    });

  if (lines.length === 0) {
    throw new Error("Mindestens eine Position fuer Teil-Storno auswaehlen.");
  }

  return {
    request_id: input.requestId,
    kind: "PARTIAL",
    reason,
    terminal_id: input.terminalId ?? undefined,
    lines
  };
}

export function calculatePartialStornoTotal(snapshot: OrderSnapshotResponse, selectedQuantities: PartialStornoSelection) {
  return Object.entries(selectedQuantities).reduce((sum, [lineId, quantity]) => {
    const line = snapshot.lines.find((candidate) => candidate.id === lineId);
    return sum + (line ? line.unit_total * quantity : 0);
  }, 0);
}

function requireReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) {
    throw new Error("Storno-Grund ist erforderlich.");
  }
  return normalized;
}
