import {
  DoorOpenIcon,
  EllipsisIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@easytable/ui/components/button";
import { cn } from "@easytable/ui/lib/utils";

import type { PosScreen } from "../App";

type PosBottomNavProps = {
  activeScreen: PosScreen;
  onNavigate: (screen: PosScreen) => void;
  cashTarget?: Extract<PosScreen, "tables" | "cash">;
};

type PosBottomNavItem = {
  label: string;
  icon: LucideIcon;
  screen: PosScreen;
  activeWhen: PosScreen[];
};

function getCashTarget(activeScreen: PosScreen) {
  return activeScreen === "cash" ? "cash" : "tables";
}

export function PosBottomNav({
  activeScreen,
  onNavigate,
  cashTarget = getCashTarget(activeScreen),
}: PosBottomNavProps) {
  const navItems: PosBottomNavItem[] = [
    {
      label: "Kasse",
      icon: ReceiptTextIcon,
      screen: cashTarget,
      activeWhen: ["tables", "cash"],
    },
    {
      label: "Mehr",
      icon: EllipsisIcon,
      screen: "more",
      activeWhen: ["more"],
    },
    {
      label: "Abmelden",
      icon: DoorOpenIcon,
      screen: "logout",
      activeWhen: ["logout"],
    },
  ];

  return (
    <footer className="grid h-16 shrink-0 grid-cols-3 border-t bg-background px-2 py-1.5">
      {navItems.map(({ label, icon: Icon, screen, activeWhen }) => {
        const active = activeWhen.includes(activeScreen);

        return (
          <Button
            key={label}
            variant="ghost"
            className={cn(
              "flex h-full flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition",
              active
                ? "bg-slate-950 text-white shadow-sm hover:bg-slate-900 hover:text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(screen)}
          >
            <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Button>
        );
      })}
    </footer>
  );
}
