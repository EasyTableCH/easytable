import {
  ArrowLeftIcon,
  DoorOpenIcon,
  EllipsisIcon,
  LinkIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RouterIcon,
  SettingsIcon,
  UnlinkIcon,
  WalletCardsIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@easytable/ui/components/button";
import { cn } from "@easytable/ui/lib/utils";

import type { PosScreen } from "../App";
import {
  clearTerminalPairingConfig,
  getDefaultPairingUrl,
  getLocalMasterUrl,
  getLocalMasterBlockedReason,
  getStoredTerminalConfig,
  loadLocalMasterIdentity,
  loadPosSettings,
  pairTerminal,
  sendTerminalHeartbeat,
  startPairingSession,
} from "../lib/local-master-client";
import type { LocalMasterIdentity, PairingSession, PosSettingsFile, TerminalPairingConfig } from "../lib/pos-types";
import { CashCloseScreen } from "./CashCloseScreen";

type MoreScreenProps = {
  onNavigate: (screen: PosScreen) => void;
};

const navItems = [
  { label: "Kasse", icon: ReceiptTextIcon, screen: "tables", active: false },
  { label: "Mehr", icon: EllipsisIcon, screen: "more", active: true },
  { label: "Abmelden", icon: DoorOpenIcon, screen: "logout", active: false },
] as const satisfies readonly {
  label: string;
  icon: typeof ReceiptTextIcon;
  screen: PosScreen;
  active: boolean;
}[];

const moreItems = [
  {
    label: "Einstellungen",
    description: "System & Hardware",
    icon: SettingsIcon,
    tone: "bg-indigo-50 text-indigo-700",
    view: "local-master-settings",
  },
  {
    label: "Kassenabschluss",
    description: "Tagesabschluss",
    icon: WalletCardsIcon,
    tone: "bg-emerald-50 text-emerald-700",
    view: "cash-close",
  },
] as const;

type MoreView = "menu" | "cash-close" | "local-master-settings";

export function MoreScreen({ onNavigate }: MoreScreenProps) {
  const [activeView, setActiveView] = useState<MoreView>("menu");
  const [settingsFile, setSettingsFile] = useState<PosSettingsFile | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const loadedSettings = await loadPosSettings();

        if (isMounted) {
          setSettingsFile(loadedSettings);
        }
      } catch (error) {
        console.warn("Could not load POS settings file.", error);
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  if (activeView === "cash-close") {
    return <CashCloseScreen onBack={() => setActiveView("menu")} />;
  }

  if (activeView === "local-master-settings") {
    return <LocalMasterSettingsScreen onBack={() => setActiveView("menu")} />;
  }

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,10rem))] gap-4">
          {moreItems.map(({ label, description, icon: Icon, tone, view }) => (
            <button
              key={label}
              className="flex aspect-square flex-col items-center justify-center rounded-md bg-white p-4 text-center shadow-md shadow-slate-200/80 ring-1 ring-slate-200 transition active:scale-[0.985] active:bg-slate-50"
              type="button"
              onClick={() => setActiveView(view)}
            >
              <span
                className={cn(
                  "mb-4 flex size-12 items-center justify-center rounded-md",
                  tone,
                )}
              >
                <Icon className="size-7" />
              </span>
              <span className="text-sm font-black text-slate-950">{label}</span>
              <span className="mt-1 text-[0.62rem] font-black uppercase text-slate-400">
                {description}
              </span>
            </button>
          ))}
        </div>

        {settingsFile ? (
          <section className="mt-8 max-w-2xl rounded-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400">
              POS Orientierung
            </p>
            <div className="mt-3 grid gap-3 text-sm font-bold text-slate-600 sm:grid-cols-2">
              <p>
                Tenant{" "}
                <span className="font-black text-slate-950">
                  {settingsFile.settings.tenant_id}
                </span>
              </p>
              <p>
                Location{" "}
                <span className="font-black text-slate-950">
                  {settingsFile.settings.location_id}
                </span>
              </p>
              <p>
                Sprache{" "}
                <span className="font-black text-slate-950">
                  {settingsFile.settings.language}
                </span>
              </p>
              <p className="truncate">
                Datei{" "}
                <span className="font-black text-slate-950">
                  {settingsFile.path}
                </span>
              </p>
            </div>
          </section>
        ) : null}
      </section>

      <footer className="grid h-16 shrink-0 grid-cols-3 border-t border-slate-200 bg-white">
        {navItems.map(({ label, icon: Icon, screen, active }) => (
          <Button
            key={label}
            variant="ghost"
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 rounded-none text-xs font-black uppercase transition active:bg-slate-100",
              active ? "text-indigo-800" : "text-slate-500",
            )}
            onClick={() => onNavigate(screen)}
          >
            <Icon className="size-5" />
            {label}
          </Button>
        ))}
      </footer>
    </main>
  );
}

function LocalMasterSettingsScreen({ onBack }: { onBack: () => void }) {
  const [endpoint, setEndpoint] = useState(getDefaultPairingUrl());
  const [terminalName, setTerminalName] = useState("Kasse 1");
  const [pairingCode, setPairingCode] = useState("");
  const [identity, setIdentity] = useState<LocalMasterIdentity | null>(null);
  const [pairingSession, setPairingSession] = useState<PairingSession | null>(null);
  const [terminalConfig, setTerminalConfig] = useState<TerminalPairingConfig | null>(getStoredTerminalConfig());
  const [status, setStatus] = useState(getLocalMasterBlockedReason() ?? "Bereit");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pairingPayload = useMemo(() => {
    if (!pairingSession) {
      return "";
    }

    return JSON.stringify({
      type: "easytable-local-master-pairing",
      url: endpoint,
      code: pairingSession.code,
      instanceId: pairingSession.instance_id,
      expiresAt: pairingSession.expires_at,
    });
  }, [endpoint, pairingSession]);
  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);

    try {
      await action();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsBusy(false);
    }
  }

  function updateTerminalConfig(config: TerminalPairingConfig | null) {
    setTerminalConfig(config);
  }

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Button variant="ghost" className="size-11 p-0" onClick={onBack}>
          <ArrowLeftIcon className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-400">Einstellungen</p>
          <h1 className="truncate text-lg font-black text-slate-950">LocalMaster</h1>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                <RouterIcon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase text-slate-400">Verbindung</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">{getLocalMasterUrl()}</p>
                <p className="mt-2 text-sm font-bold text-slate-500">{status}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                LocalMaster URL
                <input
                  className="h-12 rounded-md border border-slate-200 px-3 text-base font-bold normal-case text-slate-950 outline-none focus:border-indigo-500"
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  placeholder="http://192.168.1.20:3000"
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Terminal
                <input
                  className="h-12 rounded-md border border-slate-200 px-3 text-base font-bold normal-case text-slate-950 outline-none focus:border-indigo-500"
                  value={terminalName}
                  onChange={(event) => setTerminalName(event.target.value)}
                  placeholder="Kasse 1"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button
                className="h-12 gap-2 rounded-md font-black"
                disabled={isBusy}
                onClick={() =>
                  runAction(async () => {
                    const loadedIdentity = await loadLocalMasterIdentity(endpoint);
                    setIdentity(loadedIdentity);

                    if (
                      terminalConfig &&
                      terminalConfig.localMasterInstanceId !== loadedIdentity.instance_id
                    ) {
                      setStatus("Andere LocalMaster Instanz erkannt. Neu koppeln erforderlich.");
                      return;
                    }

                    setStatus("Verbindung aktiv");
                  })
                }
              >
                <RefreshCwIcon className="size-4" />
                Testen
              </Button>
              <Button
                className="h-12 gap-2 rounded-md bg-slate-950 font-black text-white hover:bg-slate-800"
                disabled={isBusy}
                onClick={() =>
                  runAction(async () => {
                    const session = await startPairingSession({ local_master_url: endpoint }, endpoint);
                    setPairingSession(session);
                    setPairingCode(session.code);
                    setStatus("Pairing-Code aktiv bis " + new Date(session.expires_at).toLocaleTimeString("de-CH"));
                  })
                }
              >
                <LinkIcon className="size-4" />
                Code erzeugen
              </Button>
              <Button
                className="h-12 gap-2 rounded-md font-black"
                disabled={isBusy || !terminalConfig}
                variant="outline"
                onClick={() =>
                  runAction(async () => {
                    await sendTerminalHeartbeat();
                    const updatedConfig = getStoredTerminalConfig();
                    updateTerminalConfig(updatedConfig);
                    setStatus("Terminal Heartbeat gesendet");
                  })
                }
              >
                <RefreshCwIcon className="size-4" />
                Heartbeat
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_9rem]">
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Code
                <input
                  className="h-12 rounded-md border border-slate-200 px-3 text-center text-xl font-black tracking-[0.2em] text-slate-950 outline-none focus:border-indigo-500"
                  value={pairingCode}
                  onChange={(event) => setPairingCode(event.target.value)}
                  placeholder="000000"
                />
              </label>
              <div className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Pairing Payload
                <div className="flex h-12 items-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-xs font-bold normal-case text-slate-500">
                  <span className="truncate">{pairingPayload || "Code erzeugen oder Code vom Master-PC eingeben"}</span>
                </div>
              </div>
              <Button
                className="mt-5 h-12 rounded-md bg-indigo-700 font-black text-white hover:bg-indigo-800"
                disabled={isBusy || pairingCode.trim().length === 0}
                onClick={() =>
                  runAction(async () => {
                    const config = await pairTerminal(endpoint, {
                      code: pairingCode,
                      terminal_name: terminalName,
                      role: endpoint.includes("localhost") ? "MASTER_POS" : "POS_TERMINAL",
                    });
                    updateTerminalConfig(config);
                    setStatus("Terminal gekoppelt");
                  })
                }
              >
                Koppeln
              </Button>
            </div>
{error ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400">Status</p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-600">
              <StatusRow label="Service" value={identity?.service ?? "Nicht getestet"} />
              <StatusRow label="Instance" value={identity?.instance_id ?? terminalConfig?.localMasterInstanceId ?? "-"} />
              <StatusRow label="Location" value={identity?.location_id ?? "-"} />
              <StatusRow label="Port" value={identity?.port ? String(identity.port) : "-"} />
              <StatusRow label="Terminal" value={terminalConfig?.terminalName ?? "Nicht gekoppelt"} />
              <StatusRow label="Terminal-ID" value={terminalConfig?.terminalId ?? "-"} />
              <StatusRow
                label="Zuletzt gesehen"
                value={terminalConfig ? new Date(terminalConfig.lastSeenAt).toLocaleString("de-CH") : "-"}
              />
            </div>

            <Button
              className="mt-5 h-11 w-full gap-2 rounded-md font-black"
              disabled={isBusy || !terminalConfig}
              variant="outline"
              onClick={() =>
                runAction(async () => {
                  await clearTerminalPairingConfig();
                  updateTerminalConfig(null);
                  setStatus("Terminal-Kopplung entfernt");
                })
              }
            >
              <UnlinkIcon className="size-4" />
              Neu koppeln
            </Button>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[0.65rem] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-black text-slate-950">{value}</p>
    </div>
  );
}
