import { useState } from "react";

import { CashRegisterScreen } from "./screens/CashRegisterScreen";

export type PosScreen = "cash" | "more" | "logout";

function App() {
  const [activeScreen, setActiveScreen] = useState<PosScreen>("cash");

  if (activeScreen === "cash") {
    return <CashRegisterScreen onNavigate={setActiveScreen} />;
  }

  return (
    <main className="flex h-svh touch-manipulation items-center justify-center bg-[#f6f7fb] p-6 text-slate-950">
      <section className="flex w-full max-w-md flex-col items-center gap-5 rounded-md bg-white p-8 text-center shadow-md shadow-slate-200/80 ring-1 ring-slate-200">
        <p className="text-sm font-black uppercase text-indigo-800">
          {activeScreen === "more" ? "Mehr" : "Abmelden"}
        </p>
        <p className="text-base font-bold text-slate-500">
          Dieser POS Bereich wird als eigener Screen gerendert.
        </p>
        <button
          className="h-12 rounded-md bg-slate-950 px-5 text-sm font-black uppercase text-white transition active:scale-[0.98]"
          onClick={() => setActiveScreen("cash")}
        >
          Zur Kasse
        </button>
      </section>
    </main>
  );
}

export default App;
