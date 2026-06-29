import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  getLocalRealtimeUrl,
  getRealtimeWsUrl,
  loadCatalog,
  loadTables,
  submitOrder,
  type DraftItem,
  type RealtimeEvent,
  type StaffProduct,
  type StaffTable,
} from "./lib/realtime";

type ConnectionState = "connecting" | "online" | "offline";

function getDeviceId() {
  const key = "easytable.staff.deviceId";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const next = `staff-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value / 100);
}

function App() {
  const [deviceId] = useState(getDeviceId);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [products, setProducts] = useState<StaffProduct[]>([]);
  const [tables, setTables] = useState<StaffTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const categories = Array.from(new Set(products.map((product) => product.category)));

  const draftTotal = useMemo(() => {
    return draftItems.reduce((total, item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return total + (product?.price ?? 0) * item.quantity;
    }, 0);
  }, [draftItems, products]);

  async function refreshData() {
    setIsLoading(true);
    setError(null);

    try {
      const [nextProducts, nextTables] = await Promise.all([
        loadCatalog(),
        loadTables(),
      ]);
      setProducts(nextProducts);
      setTables(nextTables);
      setSelectedTableId((current) => current || nextTables[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Verbindung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  }

  function addProduct(product: StaffProduct) {
    setDraftItems((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { productId: product.id, quantity: 1 }];
    });
  }

  function reduceProduct(productId: string) {
    setDraftItems((current) =>
      current.flatMap((item) => {
        if (item.productId !== productId) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [{ ...item, quantity: item.quantity - 1 }];
      }),
    );
  }

  async function handleSubmitOrder() {
    if (!selectedTableId || draftItems.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitOrder({
        source: "STAFF",
        deviceId,
        tableId: selectedTableId,
        guestCount,
        items: draftItems,
      });
      setDraftItems([]);
      await refreshData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Bestellung fehlgeschlagen");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    function connect() {
      setConnectionState("connecting");
      socket = new WebSocket(getRealtimeWsUrl());

      socket.addEventListener("open", () => {
        setConnectionState("online");
        socket?.send(JSON.stringify({ type: "HELLO", payload: { deviceId, role: "STAFF" } }));
      });

      socket.addEventListener("message", (message) => {
        try {
          const event = JSON.parse(message.data as string) as RealtimeEvent;
          setEvents((current) => [event, ...current].slice(0, 8));

          if (event.type.includes("ORDER") || event.type.includes("TABLE")) {
            void refreshData();
          }
        } catch {
          setEvents((current) => [
            { type: "RAW_MESSAGE", payload: message.data },
            ...current,
          ].slice(0, 8));
        }
      });

      socket.addEventListener("close", () => {
        setConnectionState("offline");
        reconnectTimer = window.setTimeout(connect, 2000);
      });

      socket.addEventListener("error", () => {
        setConnectionState("offline");
      });
    }

    connect();

    return () => {
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [deviceId]);

  return (
    <main className="min-h-svh touch-manipulation bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-slate-500">
              EasyTable Staff
            </p>
            <h1 className="text-xl font-black">Order Mode</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill state={connectionState} />
            <button
              className="grid size-11 place-items-center rounded-md bg-slate-950 text-white active:scale-95"
              onClick={refreshData}
              title="Aktualisieren"
              type="button"
            >
              <RefreshCw className={`size-5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-600">
              <Smartphone className="size-4" />
              <span>{deviceId}</span>
            </div>
            <p className="break-all text-xs font-bold text-slate-500">
              {getLocalRealtimeUrl()}
            </p>
            {error ? (
              <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-bold text-rose-800">
                {error}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="flex flex-col gap-2 rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <span className="text-xs font-black uppercase text-slate-500">Tisch</span>
              <select
                className="h-12 rounded-md border border-slate-200 bg-white px-3 text-base font-black"
                onChange={(event) => setSelectedTableId(event.target.value)}
                value={selectedTableId}
              >
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} {table.status ? `(${table.status})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <span className="text-xs font-black uppercase text-slate-500">Gäste</span>
              <input
                className="h-12 rounded-md border border-slate-200 px-3 text-base font-black"
                min={1}
                onChange={(event) => setGuestCount(Number(event.target.value))}
                type="number"
                value={guestCount}
              />
            </label>
          </div>

          {categories.map((category) => (
            <section key={category} className="space-y-2">
              <h2 className="px-1 text-sm font-black uppercase text-slate-500">
                {category}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {products
                  .filter((product) => product.category === category)
                  .map((product) => (
                    <button
                      className="flex min-h-20 items-center justify-between gap-3 rounded-md bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-50"
                      disabled={product.isAvailable === false}
                      key={product.id}
                      onClick={() => addProduct(product)}
                      type="button"
                    >
                      <span>
                        <span className="block text-base font-black">{product.name}</span>
                        <span className="block text-sm font-bold text-slate-500">
                          {formatMoney(product.price)}
                        </span>
                      </span>
                      <Plus className="size-5 shrink-0" />
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-md bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 p-4">
              <p className="text-xs font-black uppercase text-slate-500">
                Aktueller Draft
              </p>
              <h2 className="text-xl font-black">
                {selectedTable?.name ?? "Kein Tisch"}
              </h2>
            </div>

            <div className="max-h-[42svh] space-y-2 overflow-auto p-3">
              {draftItems.length === 0 ? (
                <div className="grid min-h-28 place-items-center rounded-md bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                  Produkte antippen, Bestellung bleibt bis zur Bestätigung lokal.
                </div>
              ) : null}

              {draftItems.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);

                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3"
                    key={item.productId}
                  >
                    <div>
                      <p className="font-black">{product?.name ?? item.productId}</p>
                      <p className="text-sm font-bold text-slate-500">
                        {item.quantity} x {formatMoney(product?.price ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="grid size-10 place-items-center rounded-md bg-white ring-1 ring-slate-200 active:scale-95"
                        onClick={() => reduceProduct(item.productId)}
                        title="Entfernen"
                        type="button"
                      >
                        <Minus className="size-4" />
                      </button>
                      <button
                        className="grid size-10 place-items-center rounded-md bg-slate-950 text-white active:scale-95"
                        onClick={() => product && addProduct(product)}
                        title="Hinzufügen"
                        type="button"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 border-t border-slate-200 p-4">
              <div className="flex items-center justify-between text-lg font-black">
                <span>Total</span>
                <span>{formatMoney(draftTotal)}</span>
              </div>
              <button
                className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-base font-black text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!selectedTableId || draftItems.length === 0 || isSubmitting}
                onClick={handleSubmitOrder}
                type="button"
              >
                <Send className="size-5" />
                Bestellung senden
              </button>
            </div>
          </section>

          <section className="rounded-md bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="size-4" />
              <h2 className="text-sm font-black uppercase text-slate-600">
                Live Events
              </h2>
            </div>
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="rounded-md bg-slate-50 p-3 text-sm font-bold text-slate-500">
                  Noch keine Events empfangen.
                </p>
              ) : null}
              {events.map((event, index) => (
                <div className="rounded-md bg-slate-50 p-3" key={`${event.type}-${index}`}>
                  <p className="text-sm font-black">{event.type}</p>
                  <p className="truncate text-xs font-bold text-slate-500">
                    {JSON.stringify(event.payload ?? {})}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function StatusPill({ state }: { state: ConnectionState }) {
  const isOnline = state === "online";
  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <div
      className={`flex h-11 items-center gap-2 rounded-md px-3 text-sm font-black ${
        isOnline
          ? "bg-emerald-50 text-emerald-800"
          : state === "connecting"
            ? "bg-amber-50 text-amber-800"
            : "bg-rose-50 text-rose-800"
      }`}
    >
      <Icon className="size-4" />
      <span>{state}</span>
    </div>
  );
}

export default App;
