import { ArrowLeftIcon, RefreshCwIcon, Undo2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@easytable/ui/components/button";
import { cn } from "@easytable/ui/lib/utils";

import {
  createClientRequestId,
  createOrderStorno,
  getStoredTerminalConfig,
  loadOrderSnapshot,
  loadReportingOrderSnapshots
} from "../lib/local-master-client";
import type { OrderSnapshotListItem, OrderSnapshotResponse } from "../lib/pos-types";
import { buildFullStornoRequest, buildPartialStornoRequest, calculatePartialStornoTotal } from "./storno/stornoModel";

type StornoScreenProps = {
  onBack: () => void;
};

type StornoMode = "FULL" | "PARTIAL";

export function StornoScreen({ onBack }: StornoScreenProps) {
  const [from, setFrom] = useState(formatDateInput(new Date()));
  const [to, setTo] = useState(formatDateInput(new Date()));
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [snapshots, setSnapshots] = useState<OrderSnapshotListItem[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<OrderSnapshotResponse | null>(null);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<StornoMode>("FULL");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTotal = useMemo(() => {
    if (!selectedSnapshot) return 0;
    return calculatePartialStornoTotal(selectedSnapshot, selectedQuantities);
  }, [selectedQuantities, selectedSnapshot]);

  async function refresh() {
    setIsLoading(true);
    setError(null);

    try {
      const loaded = await loadReportingOrderSnapshots({
        from,
        to,
        query: query.trim() || undefined,
        payment_method: paymentMethod || undefined
      });
      setSnapshots(loaded);
      if (selectedSnapshot) {
        const updated = await loadOrderSnapshot(selectedSnapshot.order_id);
        setSelectedSnapshot(updated);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Stornos konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  async function selectSnapshot(snapshot: OrderSnapshotListItem) {
    setError(null);
    setMessage(null);
    setSelectedQuantities({});
    setMode(snapshot.remaining_total > 0 ? "FULL" : "PARTIAL");

    try {
      setSelectedSnapshot(await loadOrderSnapshot(snapshot.order_id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Order-Beleg konnte nicht geladen werden.");
    }
  }

  async function submitStorno() {
    if (!selectedSnapshot) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const terminalId = getStoredTerminalConfig()?.terminalId ?? selectedSnapshot.terminal_id;
      const request = mode === "FULL"
        ? buildFullStornoRequest({
          snapshot: selectedSnapshot,
          reason,
          requestId: createClientRequestId("pos_storno_full"),
          terminalId
        })
        : buildPartialStornoRequest({
          snapshot: selectedSnapshot,
          selectedQuantities,
          reason,
          requestId: createClientRequestId("pos_storno_partial"),
          terminalId
        });

      const result = await createOrderStorno(selectedSnapshot.order_id, request);
      setMessage("Storno gebucht: " + formatMoney(result.refunded_amount) + ".");
      setReason("");
      setSelectedQuantities({});
      setSelectedSnapshot(await loadOrderSnapshot(selectedSnapshot.order_id));
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Storno fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Button variant="ghost" className="size-11 p-0" onClick={onBack}>
          <ArrowLeftIcon className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase text-slate-400">Korrekturen</p>
          <h1 className="truncate text-lg font-black text-slate-950">Storno</h1>
        </div>
        <Button className="h-11 gap-2 rounded-md font-black" disabled={isLoading} variant="outline" onClick={() => void refresh()}>
          <RefreshCwIcon className="size-4" />
          Aktualisieren
        </Button>
      </header>

      <section className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Von
                <input className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-950 outline-none focus:border-indigo-500" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Bis
                <input className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-950 outline-none focus:border-indigo-500" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
            <input
              className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-950 outline-none focus:border-indigo-500"
              placeholder="Bon, Order, Produkt, Tisch suchen"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
              <select
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-indigo-500"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="">Alle Zahlarten</option>
                <option value="CASH">Cash</option>
                <option value="CARD_MANUAL">Karte manuell</option>
                <option value="WALLEE_TERMINAL">Wallee</option>
              </select>
              <Button className="h-11 rounded-md font-black" onClick={() => void refresh()}>
                Suchen
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <p className="rounded-md bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">Lade bezahlte Orders.</p>
            ) : snapshots.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">Keine bezahlten Orders fuer diese Filter.</p>
            ) : (
              <div className="grid gap-2">
                {snapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    className={cn(
                      "rounded-md border px-3 py-3 text-left transition active:scale-[0.99]",
                      selectedSnapshot?.order_id === snapshot.order_id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
                    )}
                    type="button"
                    onClick={() => void selectSnapshot(snapshot)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{snapshot.order_number}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {snapshot.table_context?.table_name ?? "Counter"} · {formatPaymentMethod(snapshot.payment.method)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-950">{formatMoney(snapshot.total)}</p>
                        <p className={cn("mt-1 text-[0.65rem] font-black uppercase", snapshot.storno_state === "NONE" ? "text-emerald-700" : snapshot.storno_state === "FULL" ? "text-red-700" : "text-amber-700")}>
                          {formatStornoState(snapshot.storno_state)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          {error ? <StatusBox tone="error" message={error} /> : null}
          {message ? <StatusBox tone="success" message={message} /> : null}

          {!selectedSnapshot ? (
            <div className="grid min-h-[24rem] place-items-center rounded-md bg-slate-50 p-6 text-center">
              <div>
                <Undo2Icon className="mx-auto size-10 text-slate-400" />
                <p className="mt-3 text-sm font-black text-slate-950">Order waehlen</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Links eine bezahlte Order auswaehlen, dann Voll- oder Teilstorno buchen.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase text-slate-400">Beleg</p>
                  <h2 className="truncate text-2xl font-black text-slate-950">{selectedSnapshot.order_number}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedSnapshot.table_context?.table_name ?? "Counter"} · {new Date(selectedSnapshot.created_at).toLocaleString("de-CH")}
                  </p>
                </div>
                <div className="grid gap-1 text-right text-sm font-bold">
                  <p>Total <span className="font-black text-slate-950">{formatMoney(selectedSnapshot.total)}</span></p>
                  <p>Storniert <span className="font-black text-slate-950">{formatMoney(selectedSnapshot.refunded_total)}</span></p>
                  <p>Rest <span className="font-black text-slate-950">{formatMoney(selectedSnapshot.remaining_total)}</span></p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="h-12 rounded-md font-black" variant={mode === "FULL" ? "default" : "outline"} onClick={() => setMode("FULL")}>
                  Vollstorno
                </Button>
                <Button className="h-12 rounded-md font-black" variant={mode === "PARTIAL" ? "default" : "outline"} onClick={() => setMode("PARTIAL")}>
                  Teilstorno
                </Button>
              </div>

              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Grund
                <textarea
                  className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold normal-case text-slate-950 outline-none focus:border-indigo-500"
                  placeholder="Pflichtfeld fuer Audit und Buchhaltung"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>

              <div className="grid gap-3">
                {selectedSnapshot.lines.map((line) => (
                  <div key={line.id} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{line.product_name}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {line.product_category} · {line.quantity} × {formatMoney(line.unit_total)}
                      </p>
                    </div>
                    <p className="text-sm font-black text-slate-950">{formatMoney(line.line_total)}</p>
                    {mode === "PARTIAL" ? (
                      <input
                        className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none focus:border-indigo-500"
                        min={0}
                        max={line.quantity}
                        step={1}
                        type="number"
                        value={selectedQuantities[line.id] ?? 0}
                        onChange={(event) => setSelectedQuantities((current) => ({
                          ...current,
                          [line.id]: Number(event.target.value)
                        }))}
                      />
                    ) : (
                      <span className="rounded bg-white px-3 py-2 text-center text-xs font-black uppercase text-slate-500">Alle</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-500">
                  {mode === "FULL" ? "Storno-Betrag" : "Ausgewaehlter Betrag"}{" "}
                  <span className="font-black text-slate-950">
                    {formatMoney(mode === "FULL" ? selectedSnapshot.remaining_total : selectedTotal)}
                  </span>
                </p>
                <Button className="h-12 rounded-md bg-red-700 px-5 font-black text-white hover:bg-red-800" disabled={isSubmitting || selectedSnapshot.remaining_total <= 0} onClick={() => void submitStorno()}>
                  {isSubmitting ? "Bucht..." : "Storno buchen"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatusBox({ message, tone }: { message: string; tone: "error" | "success" }) {
  return (
    <p className={cn(
      "mb-4 rounded-md border px-3 py-2 text-sm font-bold",
      tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
    )}>
      {message}
    </p>
  );
}

function formatDateInput(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount / 100);
}

function formatPaymentMethod(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "CARD_MANUAL") return "Karte";
  if (method === "WALLEE_TERMINAL") return "Wallee";
  return method;
}

function formatStornoState(state: OrderSnapshotListItem["storno_state"]) {
  if (state === "FULL") return "Voll storniert";
  if (state === "PARTIAL") return "Teilstorno";
  return "Stornierbar";
}
