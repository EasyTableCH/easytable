import {
  DoorOpenIcon,
  EllipsisIcon,
  ReceiptTextIcon,
  SettingsIcon,
  WalletCardsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@easytable/ui/components/button";
import { cn } from "@easytable/ui/lib/utils";

import type { PosScreen } from "../App";
import { loadPosSettings } from "../lib/local-master-client";
import type { PosSettingsFile } from "../lib/pos-types";
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
  },
  {
    label: "Kassenabschluss",
    description: "Tagesabschluss",
    icon: WalletCardsIcon,
    tone: "bg-emerald-50 text-emerald-700",
  },
] as const;

type MoreView = "menu" | "cash-close";

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

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f7f8fc] text-slate-950">
      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,10rem))] gap-4">
          {moreItems.map(({ label, description, icon: Icon, tone }) => (
            <button
              key={label}
              className="flex aspect-square flex-col items-center justify-center rounded-md bg-white p-4 text-center shadow-md shadow-slate-200/80 ring-1 ring-slate-200 transition active:scale-[0.985] active:bg-slate-50"
              type="button"
              onClick={() => {
                if (label === "Kassenabschluss") {
                  setActiveView("cash-close");
                }
              }}
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

