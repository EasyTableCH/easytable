import type { FastifySchema } from "fastify";

const draftItemSchema = {
  type: "object",
  required: ["productId", "quantity"],
  additionalProperties: false,
  properties: {
    productId: { type: "string", minLength: 1 },
    quantity: { type: "integer", minimum: 1 },
    notes: { type: "string", maxLength: 500 }
  }
} as const;

const posRequestWrapperSchema = {
  type: "object",
  required: ["request"],
  additionalProperties: false,
  properties: {
    request: {
      type: "object",
      additionalProperties: true
    }
  }
} as const;

export const createOrderSchema = {
  body: {
    type: "object",
    required: ["source", "deviceId", "tableId", "guestCount", "items"],
    additionalProperties: false,
    properties: {
      source: { type: "string", const: "STAFF" },
      deviceId: { type: "string", minLength: 1 },
      tableId: { type: "string", minLength: 1 },
      guestCount: { type: "integer", minimum: 1 },
      items: {
        type: "array",
        minItems: 1,
        items: draftItemSchema
      }
    }
  },
  response: {
    201: {
      type: "object",
      required: ["success", "order"],
      properties: {
        success: { type: "boolean" },
        order: { type: "object", additionalProperties: true }
      }
    }
  }
} satisfies FastifySchema;

export const createOrderSnapshotSchema = {
  body: posRequestWrapperSchema,
  response: {
    201: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const completePaymentSchema = {
  body: posRequestWrapperSchema,
  response: {
    201: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const createStationPickupSchema = {
  body: {
    type: "object",
    required: ["request"],
    additionalProperties: false,
    properties: {
      request: {
        type: "object",
        required: ["table_id", "table_name", "station", "items"],
        additionalProperties: true,
        properties: {
          order_id: { type: "string" },
          order_number: { type: "string" },
          table_id: { type: "string", minLength: 1 },
          table_name: { type: "string", minLength: 1 },
          station: { type: "string", minLength: 1 },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["product_id", "product_name", "quantity", "variants"],
              additionalProperties: true,
              properties: {
                product_id: { type: "string", minLength: 1 },
                product_name: { type: "string", minLength: 1 },
                quantity: { type: "integer", minimum: 1 },
                variants: { type: "array" }
              }
            }
          }
        }
      }
    }
  },
  response: {
    201: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const updateKdsTicketStatusSchema = {
  body: {
    type: "object",
    required: ["request"],
    additionalProperties: false,
    properties: {
      request: {
        type: "object",
        required: ["status"],
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "DONE"] }
        }
      }
    }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;
export const currentBusinessDateSchema = {
  body: posRequestWrapperSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const dayClosePreviewSchema = {
  body: posRequestWrapperSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const saveDayCloseSchema = {
  body: posRequestWrapperSchema,
  response: {
    201: {
      type: "object",
      additionalProperties: true
    },
    409: {
      type: "object",
      required: ["error"],
      properties: {
        error: { type: "string" }
      },
      additionalProperties: false
    }
  }
} satisfies FastifySchema;


export const createPairingSessionSchema = {
  body: posRequestWrapperSchema,
  response: {
    201: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const pairTerminalSchema = {
  body: posRequestWrapperSchema,
  response: {
    201: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;

export const terminalHeartbeatSchema = {
  body: posRequestWrapperSchema,
  response: {
    200: {
      type: "object",
      additionalProperties: true
    }
  }
} satisfies FastifySchema;
