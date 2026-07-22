import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@easytable/ui/components/button";
import { Badge } from "@easytable/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easytable/ui/components/card";
import { Input } from "@easytable/ui/components/input";
import { Label } from "@easytable/ui/components/label";
import { cn } from "@easytable/ui/lib/utils";

import { TouchNumberPad } from "../components/TouchNumberPad";
import {
  createClientRequestId,
  getStoredTerminalConfig,
  loadCurrentBusinessDate,
  loadDayClosePreview,
  loadPosSettings,
  saveDayClose,
} from "../lib/local-master-client";
import { formatChf } from "../lib/money";
import type { DayClosePreview } from "../lib/pos-types";

type CashCloseScreenProps = {
  onBack: () => void;
};

const fallbackCutoverTime = "00:00";

export function CashCloseScreen({ onBack }: CashCloseScreenProps) {
  const [businessDate, setBusinessDate] = useState("");
  const [cutoverTime, setCutoverTime] = useState(fallbackCutoverTime);
  const [countedCash, setCountedCash] = useState(0);
  const [preview, setPreview] = useState<DayClosePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const cashDifference = countedCash - (preview?.expected_cash ?? 0);
  const hasCompletedOrders = (preview?.order_count ?? 0) > 0;
  const formattedWindow = useMemo(() => {
    if (!preview) {
      return "";
    }

    const start = new Date(preview.window_start_ms).toLocaleString("de-CH", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const end = new Date(preview.window_end_ms).toLocaleString("de-CH", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return `${start} - ${end}`;
  }, [preview]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSettings() {
      try {
        const settingsFile = await loadPosSettings();
        const configuredCutover =
          settingsFile.settings.business_day_cutover_time || fallbackCutoverTime;
        const currentBusinessDate = await loadCurrentBusinessDate({
          business_day_cutover_time: configuredCutover,
        });

        if (isMounted) {
          setCutoverTime(configuredCutover);
          setBusinessDate(currentBusinessDate.business_date);
        }
      } catch {
        if (isMounted) {
          setBusinessDate(new Date().toISOString().slice(0, 10));
        }
      }
    }

    void loadInitialSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!businessDate || !cutoverTime) {
      return;
    }

    let isMounted = true;

    async function loadPreview() {
      setIsLoadingPreview(true);

      try {
        const loadedPreview = await loadDayClosePreview({
          business_date: businessDate,
          business_day_cutover_time: cutoverTime,
        });

        if (isMounted) {
          setPreview(loadedPreview);
          setCountedCash(
            loadedPreview.existing_close?.counted_cash ??
              loadedPreview.expected_cash,
          );
        }
      } catch {
        if (isMounted) {
          setPreview(null);
          toast.error("Kassenabschluss konnte nicht berechnet werden.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [businessDate, cutoverTime]);

  async function handleSaveDayClose() {
    if (!businessDate || !cutoverTime || isSaving || !hasCompletedOrders) {
      return;
    }

    setIsSaving(true);

    try {
      const saved = await saveDayClose({
        request_id: createClientRequestId("day_close"),
        business_date: businessDate,
        business_day_cutover_time: cutoverTime,
        counted_cash: countedCash,
        terminal_id: getStoredTerminalConfig()?.terminalId ?? "pos-shell",
      });

      toast.success(`Kassenabschluss ${saved.business_date} wurde gespeichert.`);
      const refreshedPreview = await loadDayClosePreview({
        business_date: businessDate,
        business_day_cutover_time: cutoverTime,
      });
      setPreview(refreshedPreview);
    } catch {
      toast.error("Kassenabschluss konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-svh touch-manipulation flex-col overflow-hidden bg-muted/30 text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground"
            aria-label="Zurück"
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              Kassenabschluss
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {formattedWindow || "Geschäftstag wird geladen"}
            </p>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 lg:p-6">
        <div className="mx-auto mb-5 grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2">
          <Label className="flex h-auto flex-col items-start gap-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
            <span className="text-sm font-medium text-foreground">
              Datum
            </span>
            <Input
              className="h-11 font-medium"
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
            />
          </Label>
          <Label className="flex h-auto flex-col items-start gap-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
            <span className="text-sm font-medium text-foreground">
              Schichtende / Tageswechsel
            </span>
            <Input
              className="h-11 font-medium"
              type="time"
              value={cutoverTime}
              onChange={(event) => setCutoverTime(event.target.value)}
            />
          </Label>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(22rem,28rem)_minmax(22rem,27rem)_minmax(20rem,1fr)]">
          <TouchNumberPad
            valueInRappen={countedCash}
            onChangeValueInRappen={setCountedCash}
            label="Gezähltes Bargeld"
            disabled={isSaving}
          />

          <div className="grid gap-5">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b py-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Systemerwartung</CardTitle>
                  <CardDescription>
                    {isLoadingPreview
                      ? "Wird berechnet"
                      : "Abgeschlossene Zahlungen"}
                  </CardDescription>
                </div>
                {preview?.existing_close ? (
                  <Badge variant="secondary">Bereits gespeichert</Badge>
                ) : null}
              </div></CardHeader><CardContent className="py-5">

              <div className="grid gap-3">
                <SummaryRow label="Bargeld" value={preview?.expected_cash ?? 0} />
                <SummaryRow
                  label="Kartenzahlungen"
                  value={preview?.expected_card ?? 0}
                />
                <SummaryRow
                  label="Total"
                  value={preview?.expected_total ?? 0}
                  strong
                />
                <SummaryRow
                  label={`Offeriert (${preview?.complimentary_quantity ?? 0}x)`}
                  value={preview?.complimentary_value ?? 0}
                />
              </div>

              <div className="mt-5 grid gap-3 border-t pt-5 text-sm text-muted-foreground sm:grid-cols-2">
                <p>
                  Bestellungen{" "}
                  <span className="font-semibold text-foreground">
                    {preview?.order_count ?? 0}
                  </span>
                </p>
                <p>
                  Produkte{" "}
                  <span className="font-semibold text-foreground">
                    {preview?.item_count ?? 0}
                  </span>
                </p>
              </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-sm"><CardContent className="p-5">
              <div className="mb-6 flex items-center justify-between gap-4">
                <p className="text-base font-semibold text-foreground">Differenz</p>
                <p
                  className={cn(
                    "text-3xl font-semibold tabular-nums",
                    cashDifference === 0
                      ? "text-muted-foreground"
                      : cashDifference > 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                  )}
                >
                  {formatChf(cashDifference)}
                </p>
              </div>

              <Button
                className="h-12 w-full bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
                disabled={isSaving || isLoadingPreview || !preview || !hasCompletedOrders}
                onClick={() => void handleSaveDayClose()}
              >
                <SaveIcon className="mr-2 size-5" />
                Abschluss speichern
              </Button>
              {preview && !hasCompletedOrders ? (
                <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Keine abgeschlossenen Bestellungen im gewählten Zeitraum.
                </p>
              ) : null}
            </CardContent></Card>
          </div>

          <Card className="gap-0 overflow-y-auto py-0 shadow-sm xl:max-h-[calc(100svh-11rem)]"><CardContent className="p-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">Verkaufte Produkte</p>
                <p className="text-sm text-muted-foreground">Mengen und Umsatz</p>
              </div>
              <Badge variant="secondary">
                {preview?.product_sales.length ?? 0} Positionen
              </Badge>
            </div>

            {preview?.product_sales.length ? (
              <div className="max-h-80 overflow-y-auto rounded-lg border xl:max-h-[calc(100svh-18rem)]">
                {preview.product_sales.map((sale) => (
                  <div
                    key={`${sale.product_id}:${sale.product_name}`}
                    className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {sale.product_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {sale.product_category}
                      </p>
                    </div>
                    <p className="text-right text-sm font-medium text-muted-foreground">
                      {sale.quantity}x
                    </p>
                    <p className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatChf(sale.total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Keine verkauften Produkte im gewählten Zeitraum.
              </p>
            )}

            <div className="mb-4 mt-6 flex items-end justify-between gap-4 border-t pt-5">
              <div>
                <p className="text-base font-semibold text-foreground">Offerierte Produkte</p>
                <p className="text-sm text-muted-foreground">Mengen und Listenwert</p>
              </div>
              <Badge variant="secondary">{preview?.complimentary_sales.length ?? 0} Positionen</Badge>
            </div>
            {preview?.complimentary_sales.length ? (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {preview.complimentary_sales.map((sale) => (
                  <div key={`complimentary:${sale.product_id}:${sale.product_name}`} className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-3 border-b px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{sale.product_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{sale.product_category}</p>
                    </div>
                    <p className="text-right text-sm font-medium text-muted-foreground">{sale.quantity}x</p>
                    <p className="text-right text-sm font-semibold tabular-nums text-foreground">{formatChf(sale.total)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">Keine offerierten Produkte im gewählten Zeitraum.</p>
            )}
          </CardContent></Card>
        </div>
      </section>
    </main>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
  strong?: boolean;
};

function SummaryRow({ label, value, strong = false }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-4 py-3">
      <p
        className={cn(
          "font-medium",
          strong ? "text-base text-foreground" : "text-sm text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums text-foreground",
          strong ? "text-xl" : "text-base",
        )}
      >
        {formatChf(value)}
      </p>
    </div>
  );
}

