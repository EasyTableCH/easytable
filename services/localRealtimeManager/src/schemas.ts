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
