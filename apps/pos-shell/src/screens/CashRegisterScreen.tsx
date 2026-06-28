import {
  ArrowLeftIcon,
  BoxesIcon,
  DoorOpenIcon,
  EllipsisIcon,
  LayoutGridIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShoppingBagIcon,
} from "lucide-react";

import type { PosScreen } from "../App";

type CashRegisterScreenProps = {
  onNavigate: (screen: PosScreen) => void;
};

const categories = [
  "Alle",
  "Test",
  "Shisha",
  "Sussgetranke",
  "Heisse Getranke",
  "Bier",
  "Apero & Wein",
  "Cocktails",
  "Snacks",
] as const;

const products = [
  {
    name: "Rechnung",
    price: "CHF 0.00",
    tone: "from-slate-50 to-slate-100",
    accent: "text-slate-300",
  },
  {
    name: "Service Personal",
    price: "CHF 0.00",
    tone: "from-zinc-50 to-slate-100",
    accent: "text-slate-300",
  },
  {
    name: "Shisha Standard",
    price: "CHF 30.00",
    tone: "from-cyan-50 via-white to-indigo-100",
    accent: "text-cyan-700",
  },
  {
    name: "NAVA Shisha",
    price: "CHF 59.00",
    tone: "from-stone-50 via-white to-amber-100",
    accent: "text-stone-600",
  },
  {
    name: "SmokeZilla Laser Shisha",
    price: "CHF 89.00",
    tone: "from-emerald-900 via-teal-500 to-lime-200",
    accent: "text-lime-100",
  },
  {
    name: "Shisha Triple Skull",
    price: "CHF 45.00",
    tone: "from-neutral-50 via-white to-rose-100",
    accent: "text-rose-400",
  },
  {
    name: "Neuer Kopf",
    price: "CHF 15.00",
    tone: "from-zinc-100 via-white to-neutral-200",
    accent: "text-zinc-800",
  },
  {
    name: "Kohle",
    price: "CHF 0.00",
    tone: "from-neutral-900 via-stone-700 to-orange-300",
    accent: "text-orange-100",
  },
  {
    name: "Mundstucke",
    price: "CHF 3.00",
    tone: "from-fuchsia-200 via-sky-200 to-lime-200",
    accent: "text-fuchsia-700",
  },
  {
    name: "Chinotto",
    price: "CHF 7.00",
    tone: "from-amber-50 via-white to-orange-100",
    accent: "text-orange-700",
  },
] as const;

const navItems = [
  { label: "Kasse", icon: ShoppingBagIcon, screen: "cash", active: true },
  { label: "Mehr", icon: EllipsisIcon, screen: "more", active: false },
  { label: "Abmelden", icon: DoorOpenIcon, screen: "logout", active: false },
] as const satisfies readonly {
  label: string;
  icon: typeof ShoppingBagIcon;
  screen: PosScreen;
  active: boolean;
}[];

export function CashRegisterScreen({ onNavigate }: CashRegisterScreenProps) {
  const showTopRegion = true;

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f6f7fb] text-slate-950">
      {showTopRegion ? (
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="grid h-[clamp(4rem,10svh,6.5rem)] grid-cols-[minmax(0,1fr)_clamp(15rem,24vw,22rem)]">
            <section className="flex min-w-0 items-center gap-3 px-4">
              <button
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-slate-500 transition active:scale-95 active:bg-slate-100"
                aria-label="Zuruck"
              >
                <ArrowLeftIcon className="size-5" />
              </button>
              <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category, index) => (
                  <button
                    key={category}
                    className={[
                      "h-10 shrink-0 rounded-[2rem] px-4 text-sm font-extrabold uppercase tracking-normal transition active:scale-[0.98]",
                      index === 0
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                        : "bg-slate-100 text-slate-500 active:bg-slate-200",
                    ].join(" ")}
                  >
                    {category}
                  </button>
                ))}
              </nav>
            </section>

            <aside className="flex min-w-0 flex-col justify-center border-l border-slate-200 bg-slate-50 px-5">
              <p className="truncate text-sm font-black uppercase text-indigo-800">
                Direktverkauf
              </p>
              <p className="truncate text-[0.7rem] font-bold uppercase text-slate-400">
                Keine Artikel gewahlt
              </p>
            </aside>
          </div>
        </header>
      ) : null}

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(15rem,24vw,22rem)] overflow-hidden">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm">
              <SearchIcon className="size-5 shrink-0 text-slate-400" />
              <span className="truncate text-base font-bold text-slate-400">
                Artikel suchen
              </span>
            </div>
            <button className="flex h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-base font-black text-white shadow-lg shadow-slate-900/10 active:scale-[0.98]">
              <LayoutGridIcon className="size-5" />
              Raster
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((product, index) => (
              <button
                key={product.name}
                className="group flex aspect-[1.08] min-h-44 flex-col overflow-hidden rounded-md bg-white text-left shadow-md shadow-slate-200/80 ring-1 ring-slate-200 transition active:scale-[0.985]"
              >
                <div
                  className={`relative flex flex-1 items-center justify-center bg-gradient-to-br ${product.tone}`}
                >
                  {index < 2 ? (
                    <BoxesIcon className="size-16 text-slate-300" />
                  ) : (
                    <div
                      className={`flex size-20 items-center justify-center rounded-md bg-white/50 ${product.accent}`}
                    >
                      <BoxesIcon className="size-14" />
                    </div>
                  )}
                </div>
                <div className="flex min-h-16 items-end justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">
                      {product.name}
                    </p>
                    <p className="text-sm font-extrabold text-slate-500">
                      {product.price}
                    </p>
                  </div>
                  {index > 1 ? (
                    <span className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">
                      Varianten
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain px-6 text-center">
            <ReceiptTextIcon className="mb-4 size-14 text-slate-300" />
            <p className="text-base font-black text-slate-400">
              Warenkorb leer
            </p>
          </div>
          <button className="h-18 shrink-0 bg-emerald-300 text-lg font-black uppercase text-emerald-800 transition active:bg-emerald-400 disabled:text-emerald-600">
            Bezahlen
          </button>
        </aside>
      </section>

      <footer className="grid h-16 shrink-0 grid-cols-3 border-t border-slate-200 bg-white">
        {navItems.map(({ label, icon: Icon, screen, active }) => (
          <button
            key={label}
            className={[
              "flex flex-col items-center justify-center gap-0.5 text-xs font-black uppercase transition active:bg-slate-100",
              active ? "text-indigo-800" : "text-slate-500",
            ].join(" ")}
            onClick={() => onNavigate(screen)}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </footer>
    </main>
  );
}
