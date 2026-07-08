import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { RefreshCw, WifiOff } from "lucide-react";

import { Badge } from "@easytable/ui/components/badge";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@easytable/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@easytable/ui/components/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@easytable/ui/components/table";

import {
  detectConnectionMode,
  loadPosSettings,
  loadSalesReportForConnection,
  type ConnectionMode,
  type SalesReport
} from "../../../lib/local-master";
import {
  availableCategories,
  buildAnalyticsViewModel,
  datesInRange,
  defaultAnalyticsFilters,
  rangeForPreset,
  type AnalyticsFilters,
  type AnalyticsRangePreset
} from "./analyticsModel";

const revenueChartConfig = {
  gross: { label: "Umsatz", color: "hsl(var(--chart-1))" },
  storno: { label: "Storno", color: "hsl(var(--chart-2))" }
} satisfies ChartConfig;

const productChartConfig = {
  total: { label: "Umsatz", color: "hsl(var(--chart-1))" }
} satisfies ChartConfig;

const paymentChartConfig = {
  total: { label: "Total" }
} satisfies ChartConfig;

export function OwnerAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => defaultAnalyticsFilters());
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("OFFLINE");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessDayCutoverTime, setBusinessDayCutoverTime] = useState("00:00");

  const model = useMemo(() => buildAnalyticsViewModel(reports, filters), [filters, reports]);
  const categories = useMemo(() => availableCategories(reports), [reports]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextMode = await detectConnectionMode();
      setConnectionMode(nextMode);
      const settings = nextMode === "LOCAL" ? await loadPosSettings().catch(() => null) : null;
      const cutover = settings?.settings.business_day_cutover_time ?? "00:00";
      setBusinessDayCutoverTime(cutover);
      const dates = datesInRange(filters.from, filters.to);
      const loadedReports = await Promise.all(dates.map((date) => loadSalesReportForConnection(nextMode, date, cutover)));
      setReports(loadedReports);
    } catch (loadError) {
      setReports([]);
      setError(loadError instanceof Error ? loadError.message : "Analytics konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }, [filters.from, filters.to]);

  function selectPreset(preset: AnalyticsRangePreset) {
    if (preset === "custom") {
      setFilters((current) => ({ ...current, preset }));
      return;
    }
    const range = rangeForPreset(preset);
    setFilters((current) => ({ ...current, preset, ...range }));
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-md border bg-card p-4 text-card-foreground sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Owner Analytics</p>
          <h2 className="text-2xl font-semibold tracking-normal">Umsaetze, Produkte und Stornos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quelle: LocalMaster Ledger · Cutover {businessDayCutoverTime} · {connectionMode}
          </p>
        </div>
        <Button disabled={isLoading} onClick={() => void refresh()} type="button" variant="outline">
          <RefreshCw data-icon="inline-start" />
          Aktualisieren
        </Button>
      </section>

      <AnalyticsFiltersBar filters={filters} categories={categories} onChange={setFilters} onPreset={selectPreset} />

      {error ? <ErrorBanner message={error} onRetry={() => void refresh()} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Bruttoumsatz" value={formatMoney(model.grossTotal)} />
        <MetricCard label="Netto" value={formatMoney(model.netTotal)} />
        <MetricCard label="Steuern" value={formatMoney(model.taxTotal)} />
        <MetricCard label="Orders" value={String(model.orderCount)} />
        <MetricCard label="Artikel" value={String(model.itemCount)} />
        <MetricCard label="Storno" value={formatMoney(model.stornoTotal)} />
      </section>

      {isLoading ? (
        <p className="rounded-md border bg-card p-4 text-sm font-medium text-muted-foreground">Lade Analytics.</p>
      ) : model.ledgerRows.length === 0 ? (
        <p className="rounded-md border bg-card p-4 text-sm font-medium text-muted-foreground">Keine Umsaetze fuer diese Filter.</p>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Umsatzverlauf</CardTitle>
                <CardDescription>Ledger-Umsatz und Storno-Korrekturen pro Geschaeftstag</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-72 w-full" config={revenueChartConfig}>
                  <LineChart data={model.revenueSeries}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatShortMoney(Number(value))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line dataKey="gross" type="monotone" stroke="var(--color-gross)" strokeWidth={2} dot={false} />
                    <Line dataKey="storno" type="monotone" stroke="var(--color-storno)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zahlarten</CardTitle>
                <CardDescription>Cash, Karte und Wallee nach Ledger-Zahlungseintraegen</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-72 w-full" config={paymentChartConfig}>
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="method" />} />
                    <Pie data={model.paymentSeries} dataKey="total" nameKey="method" innerRadius={58} outerRadius={92}>
                      {model.paymentSeries.map((entry, index) => (
                        <Cell key={entry.method} fill={index === 0 ? "hsl(var(--chart-1))" : index === 1 ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Top Produkte</CardTitle>
                <CardDescription>Verkaufte Produkte inklusive negativer Korrekturen</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-72 w-full" config={productChartConfig}>
                  <BarChart data={model.productRows.slice(0, 8)}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="productName" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatShortMoney(Number(value))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Split</CardTitle>
                <CardDescription>Summen nach Zahlungsart</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <PaymentRow label="Cash" value={model.paymentTotals.cash} />
                <PaymentRow label="Karte manuell" value={model.paymentTotals.cardManual} />
                <PaymentRow label="Wallee Terminal" value={model.paymentTotals.walleeTerminal} />
              </CardContent>
            </Card>
          </section>

          <AnalyticsTables model={model} />
        </>
      )}
    </div>
  );
}

function AnalyticsFiltersBar({
  categories,
  filters,
  onChange,
  onPreset
}: {
  categories: string[];
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  onPreset: (preset: AnalyticsRangePreset) => void;
}) {
  return (
    <section className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[repeat(7,minmax(0,1fr))]">
      <select className="h-10 rounded-md border bg-background px-3 text-sm font-medium" value={filters.preset} onChange={(event) => onPreset(event.target.value as AnalyticsRangePreset)}>
        <option value="today">Heute</option>
        <option value="yesterday">Gestern</option>
        <option value="week">Woche</option>
        <option value="month">Monat</option>
        <option value="custom">Custom</option>
      </select>
      <input className="h-10 rounded-md border bg-background px-3 text-sm font-medium" type="date" value={filters.from} onChange={(event) => onChange({ ...filters, preset: "custom", from: event.target.value })} />
      <input className="h-10 rounded-md border bg-background px-3 text-sm font-medium" type="date" value={filters.to} onChange={(event) => onChange({ ...filters, preset: "custom", to: event.target.value })} />
      <select className="h-10 rounded-md border bg-background px-3 text-sm font-medium" value={filters.paymentMethod} onChange={(event) => onChange({ ...filters, paymentMethod: event.target.value })}>
        <option value="">Alle Zahlarten</option>
        <option value="CASH">Cash</option>
        <option value="CARD_MANUAL">Karte</option>
        <option value="WALLEE_TERMINAL">Wallee</option>
      </select>
      <select className="h-10 rounded-md border bg-background px-3 text-sm font-medium" value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value })}>
        <option value="">Alle Kategorien</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <input className="h-10 rounded-md border bg-background px-3 text-sm font-medium" placeholder="Terminal" value={filters.terminalId} onChange={(event) => onChange({ ...filters, terminalId: event.target.value })} />
      <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium">
        <input checked={filters.includeStornos} type="checkbox" onChange={(event) => onChange({ ...filters, includeStornos: event.target.checked })} />
        Stornos
      </label>
    </section>
  );
}

function AnalyticsTables({ model }: { model: ReturnType<typeof buildAnalyticsViewModel> }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Produktumsatz</CardTitle>
          <CardDescription>Snapshot-basierte Produkte, keine aktuellen Catalog-Werte</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.productRows.slice(0, 20).map((row) => (
                <TableRow key={row.productKey}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell>{row.productCategory}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger Bewegungen</CardTitle>
          <CardDescription>Append-only Sales Ledger inklusive Storno</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.ledgerRows.slice(0, 25).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell><Badge variant="secondary">{formatEntryType(entry.entry_type)}</Badge></TableCell>
                  <TableCell>{entry.order_number}</TableCell>
                  <TableCell>{entry.reason ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatMoney(entry.gross_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function PaymentRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-3 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold">{formatMoney(value)}</span>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <WifiOff className="mt-0.5 size-5 shrink-0" />
        <p className="break-words text-sm font-medium">{message}</p>
      </div>
      <Button onClick={onRetry} type="button" variant="outline">
        Erneut laden
      </Button>
    </div>
  );
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount / 100);
}

function formatShortMoney(amount: number) {
  return new Intl.NumberFormat("de-CH", { notation: "compact", maximumFractionDigits: 1 }).format(amount / 100);
}

function formatEntryType(type: string) {
  if (type === "SALE_COMPLETED") return "Sale";
  if (type === "PAYMENT_RECORDED") return "Payment";
  if (type === "ORDER_VOIDED") return "Vollstorno";
  if (type === "ORDER_PARTIALLY_VOIDED") return "Teilstorno";
  if (type === "REFUND_RECORDED") return "Refund";
  return type;
}
