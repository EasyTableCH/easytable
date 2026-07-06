import type { FastifyReply, FastifyRequest } from "fastify";

export type RelayRealtimeEvent = {
  id?: string;
  type: string;
  createdAt?: number;
  payload?: unknown;
};

type RelayRealtimeClient = {
  id: string;
  write: (event: RelayRealtimeEvent) => void;
};

const clientsByLocation = new Map<string, Set<RelayRealtimeClient>>();

export async function openRelayLocationEventStream(
  tenantId: string,
  locationId: string,
  request: FastifyRequest<{ Params: { locationId: string } }>,
  reply: FastifyReply
) {
  const key = locationKey(tenantId, locationId);
  const client: RelayRealtimeClient = {
    id: "relay_rt_" + Math.random().toString(36).slice(2),
    write: (event) => writeSseEvent(reply.raw, event),
  };

  reply.hijack();
  reply.raw.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no",
  });
  reply.raw.write(": connected\n\n");

  let clients = clientsByLocation.get(key);
  if (!clients) {
    clients = new Set();
    clientsByLocation.set(key, clients);
  }
  clients.add(client);

  const heartbeat = setInterval(() => {
    reply.raw.write(": heartbeat\n\n");
  }, 25_000);
  heartbeat.unref?.();

  request.raw.on("close", () => {
    clearInterval(heartbeat);
    clients?.delete(client);
    if (clients?.size === 0) {
      clientsByLocation.delete(key);
    }
  });
}

export function broadcastRelayLocationEvent(
  tenantId: string,
  locationId: string,
  event: RelayRealtimeEvent
) {
  const clients = clientsByLocation.get(locationKey(tenantId, locationId));
  if (!clients?.size) {
    return;
  }

  const normalized = {
    ...event,
    id: event.id ?? "relay_evt_" + Date.now() + "_" + Math.random().toString(36).slice(2),
    createdAt: event.createdAt ?? Date.now(),
  };

  for (const client of clients) {
    client.write(normalized);
  }
}

function locationKey(tenantId: string, locationId: string) {
  return tenantId + ":" + locationId;
}

function writeSseEvent(stream: NodeJS.WritableStream, event: RelayRealtimeEvent) {
  stream.write("event: " + event.type + "\n");
  if (event.id) {
    stream.write("id: " + event.id + "\n");
  }
  stream.write("data: " + JSON.stringify(event) + "\n\n");
}
