import { ArrowLeftIcon, BanknoteIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent } from "@easytable/ui/components/card";
import { cn } from "@easytable/ui/lib/utils";
import logoUrl from "@easytable/ui/assets/Logo table.svg";

import chipUrl from "../../assets/Chip.svg";
import { TouchNumberPad } from "../../components/TouchNumberPad";
import { formatChf } from "../../lib/money";
import type { PaymentMethod, PaymentRequest } from "../../lib/pos-types";

type PaymentScreenProps = {
  total: number;
  isSubmitting: boolean;
  submittingMessage?: string;
  isWalleeTerminalEnabled: boolean;
  onCancel: () => void;
  onSelectMethod: (payment: PaymentRequest) => void;
};

type PaymentView = "methods" | "cash";

const cashSuggestions = [
  { label: "10 CHF", valueInRappen: 1000 },
  { label: "20 CHF", valueInRappen: 2000 },
  { label: "50 CHF", valueInRappen: 5000 },
  { label: "100 CHF", valueInRappen: 10000 },
  { label: "200 CHF", valueInRappen: 20000 },
];

export function PaymentScreen({
  total,
  isSubmitting,
  submittingMessage = "Zahlung wird verarbeitet",
  isWalleeTerminalEnabled,
  onCancel,
  onSelectMethod,
}: PaymentScreenProps) {
  const [paymentView, setPaymentView] = useState<PaymentView>("methods");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const changeAmount = Math.max(receivedAmount - total, 0);
  const canCompleteCashPayment = receivedAmount >= total && !isSubmitting;

  function handleMethodSelect(method: PaymentMethod) {
    if (method === "CASH") {
      setReceivedAmount(0);
      setPaymentView("cash");
      return;
    }

    onSelectMethod({ payment_method: method });
  }

  if (isSubmitting) {
    return (
      <main className="flex h-svh touch-manipulation flex-col items-center justify-center overflow-hidden bg-[#f6f7fb] px-6 text-center text-slate-950">
        <div className="flex size-28 items-center justify-center rounded-md bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
          <img src={logoUrl} alt="EasyTable" className="h-20 w-20 object-contain" />
        </div>
        <div className="mt-8 grid gap-2">
          <p className="text-2xl font-black text-slate-950">{submittingMessage}</p>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
            {formatChf(total)}
          </p>
        </div>
        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-indigo-500" />
        </div>
      </main>
    );
  }

  if (paymentView === "cash") {
    return (
      <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-muted/30 text-foreground">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground"
              aria-label="Zurück zur Zahlungsart"
              disabled={isSubmitting}
              onClick={() => setPaymentView("methods")}
            >
              <ArrowLeftIcon className="size-5" />
            </Button>
            <h1 className="truncate text-lg font-semibold text-foreground">
              Barzahlung
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground"
            aria-label="Zahlung abbrechen"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            <XIcon className="size-5" />
          </Button>
        </header>

        <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-5 lg:p-6">
          <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(22rem,28rem)_minmax(20rem,27rem)]">
            <TouchNumberPad
              valueInRappen={receivedAmount}
              onChangeValueInRappen={setReceivedAmount}
              label="Erhaltener Betrag"
              disabled={isSubmitting}
            />

            <Card className="gap-0 py-0 shadow-sm">
              <CardContent className="p-5">
              <div className="mb-4">
                <p className="text-base font-semibold text-foreground">Schnellbeträge</p>
                <p className="mt-1 text-sm text-muted-foreground">Betrag auswählen oder passend übernehmen.</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {cashSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion.label}
                    variant="outline"
                    className="h-14 text-base font-semibold tabular-nums active:scale-[0.975]"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setReceivedAmount(suggestion.valueInRappen)}
                  >
                    {suggestion.label}
                  </Button>
                ))}
                <Button
                  variant="secondary"
                  className="h-14 text-base font-semibold active:scale-[0.975]"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReceivedAmount(total)}
                >
                  Passend
                </Button>
              </div>

              <div className="mt-5 border-t pt-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {formatChf(total)}
                  </p>
                </div>
                <div className="mb-5 flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-4 py-4">
                  <p className="text-base font-semibold text-foreground">Wechselgeld</p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      changeAmount > 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatChf(changeAmount)}
                  </p>
                </div>

                <Button
                  className="h-12 w-full bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
                  disabled={!canCompleteCashPayment}
                  onClick={() =>
                    onSelectMethod({
                      payment_method: "CASH",
                      received_cash: receivedAmount,
                      change_given: changeAmount,
                    })
                  }
                >
                  Abschliessen
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    );
  }

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
            title="BAR"
            eyebrow="Bezahlmethode"
            description="Schnelle Abwicklung"
            disabled={isSubmitting}
            onSelectMethod={handleMethodSelect}
          />
          <PaymentMethodCard
            method="WALLEE_TERMINAL"
            title="KARTE"
            eyebrow="Kredit / Debit"
            description={isWalleeTerminalEnabled ? "Terminalzahlung" : "Terminal nicht konfiguriert"}
            dark
            disabled={isSubmitting || !isWalleeTerminalEnabled}
            onSelectMethod={handleMethodSelect}
          />
        </div>
      </section>
    </main>
  );
}

type PaymentMethodCardProps = {
  method: PaymentMethod;
  title: string;
  eyebrow: string;
  description: string;
  dark?: boolean;
  disabled: boolean;
  onSelectMethod: (method: PaymentMethod) => void;
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
      className="group text-left transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 shadow-4xl"
      disabled={disabled}
      onClick={() => onSelectMethod(method)}
    >
      <Card
        className={cn(
          "h-64 rounded-md py-0 shadow-4xl shadow-slate-900/10 ring-1 transition group-hover:-translate-y-0.5",
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
