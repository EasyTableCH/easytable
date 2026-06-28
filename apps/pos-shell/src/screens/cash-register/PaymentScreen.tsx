import { BanknoteIcon, XIcon } from "lucide-react";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent } from "@easytable/ui/components/card";
import { cn } from "@easytable/ui/lib/utils";

import chipUrl from "../../assets/Chip.svg";
import { formatChf } from "../../lib/money";
import type { MockPaymentMethod } from "../../lib/pos-types";

type PaymentScreenProps = {
  total: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onSelectMethod: (method: MockPaymentMethod) => void;
};

export function PaymentScreen({
  total,
  isSubmitting,
  onCancel,
  onSelectMethod,
}: PaymentScreenProps) {
  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-[#f6f7fb] text-slate-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5">
        <div>
          <h1 className="text-xl font-black text-slate-950">
            Zahlungsart wählen
          </h1>
          <p className="text-xs font-black uppercase text-slate-400">
            {formatChf(total)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-md text-slate-500"
          aria-label="Zahlung abbrechen"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <XIcon className="size-5" />
        </Button>
      </header>

      <section className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
        <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <PaymentMethodCard
            method="CASH"
            title="CASH"
            eyebrow="Bezahlmethode"
            description="Schnelle Abwicklung"
            disabled={isSubmitting}
            onSelectMethod={onSelectMethod}
          />
          <PaymentMethodCard
            method="CARD_MANUAL"
            title="KARTE"
            eyebrow="Kredit / Debit"
            description="Terminal Mock"
            dark
            disabled={isSubmitting}
            onSelectMethod={onSelectMethod}
          />
        </div>
      </section>
    </main>
  );
}

type PaymentMethodCardProps = {
  method: MockPaymentMethod;
  title: string;
  eyebrow: string;
  description: string;
  dark?: boolean;
  disabled: boolean;
  onSelectMethod: (method: MockPaymentMethod) => void;
};

function PaymentMethodCard({
  method,
  title,
  eyebrow,
  description,
  dark = false,
  disabled,
  onSelectMethod,
}: PaymentMethodCardProps) {
  return (
    <button
      className="group text-left transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={() => onSelectMethod(method)}
    >
      <Card
        className={cn(
          "h-64 rounded-md py-0 shadow-xl shadow-slate-900/10 ring-1 transition group-hover:-translate-y-0.5",
          dark
            ? "border-slate-950 bg-gradient-to-br from-[#191a1f] to-[#111827] text-white ring-slate-950"
            : "border-slate-200 bg-white text-slate-950 ring-slate-200",
        )}
      >
        <CardContent className="flex h-full flex-col justify-between p-7">
          <div className="flex items-start justify-between gap-5">
            <div
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-md",
                dark ? "bg-transparent" : "bg-emerald-100",
              )}
            >
              {dark ? (
                <img src={chipUrl} alt="" className="h-12 w-14 object-contain" />
              ) : (
                <BanknoteIcon className="size-9 text-emerald-600" />
              )}
            </div>
            <div className="min-w-0 text-right">
              <p
                className={cn(
                  "text-xs font-black uppercase",
                  dark ? "text-slate-400" : "text-slate-400",
                )}
              >
                {eyebrow}
              </p>
              <p className="text-2xl font-black uppercase">{title}</p>
            </div>
          </div>

          <div>
            <div
              className={cn(
                "mb-3 h-1.5 w-16 rounded-full",
                dark ? "bg-blue-500" : "bg-emerald-200",
              )}
            />
            <p
              className={cn(
                "max-w-40 text-sm font-black",
                dark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
