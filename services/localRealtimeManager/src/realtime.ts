import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { RealtimeEvent, RealtimeEventType } from "./types.js";

type ClientMessage = {
  type?: string;
  payload?: unknown;
};

interface RealtimeSocket {
  readyState: number;
  OPEN: number;
  send(payload: string): void;
  on(event: "message", listener: (message: Buffer) => void): void;
  on(event: "close", listener: () => void): void;
}

const clients = new Set<RealtimeSocket>();

export function connectedClientCount() {
  return clients.size;
}

export function createEvent(type: RealtimeEventType, payload: unknown): RealtimeEvent {
  return {
    id: randomUUID(),
    type,
    createdAt: Date.now(),
    payload
  };
}

export function broadcast(type: RealtimeEventType, payload: unknown) {
  const event = createEvent(type, payload);
  const encoded = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(encoded);
    }
  }

  return event;
}

export async function registerRealtimeRoutes(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, (socket: RealtimeSocket) => {
    clients.add(socket);

    socket.send(JSON.stringify(createEvent("CONNECTED", { clients: clients.size })));

    socket.on("message", (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as ClientMessage;

        if (message.type === "HELLO") {
          broadcast("DEVICE_CONNECTED", message.payload ?? {});
        }
      } catch (error) {
        app.log.warn({ error }, "Ignoring invalid realtime message");
        socket.send(JSON.stringify(createEvent("INVALID_MESSAGE", {})));
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      broadcast("DEVICE_DISCONNECTED", { clients: clients.size });
    });
  });
}
