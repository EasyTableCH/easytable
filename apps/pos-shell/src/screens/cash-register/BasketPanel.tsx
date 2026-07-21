import { MinusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent } from "@easytable/ui/components/card";
import { cn } from "@easytable/ui/lib/utils";

import { formatChf } from "../../lib/money";
import type { BasketLine } from "../../lib/pos-types";

type BasketPanelProps = {
  lines: BasketLine[];
  total: number;
  isSubmitting: boolean;
  bookLabel: string;
  payLabel: string;
  showBookAction?: boolean;
  onDecreaseLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onCreateOrder: () => void;
  onStartPayment: () => void;
};

export function BasketPanel({
  lines,
  total,
  isSubmitting,
  bookLabel,
  payLabel,
  showBookAction = true,
  onDecreaseLine,
  onRemoveLine,
  onCreateOrder,
  onStartPayment,
}: BasketPanelProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Warenkorb</p>
          <p className="text-xs text-muted-foreground">
            {lines.length === 0 ? "Keine Positionen" : `${lines.length} ${lines.length === 1 ? "Position" : "Positionen"}`}
          </p>
        </div>
        {lines.length > 0 ? (
          <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {lines.reduce((quantity, line) => quantity + line.quantity, 0)} Artikel
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-slate-950 ring-1 ring-foreground/5">
              <ReceiptTextIcon className="size-7" strokeWidth={1.75} />
            </span>
            <p className="text-base font-semibold text-foreground">Warenkorb leer</p>
            <p className="mt-1 max-w-48 text-sm leading-5 text-muted-foreground">
              Produkte antippen, um sie hier hinzuzufügen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <Card
                key={line.id}
                className="gap-0 rounded-xl bg-card py-0 shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        <span className="mr-1 text-muted-foreground">{line.quantity}×</span>
                        {line.product_name}
                      </p>
                      {line.variants.length > 0 ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {line.variants
                            .map((variant) => variant.variant_item_name)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatChf(line.line_total)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-full bg-background text-muted-foreground"
                      aria-label={`${line.product_name} um eins reduzieren`}
                      onClick={() => onDecreaseLine(line.id)}
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-11 w-full"
                      aria-label={`${line.product_name} entfernen`}
                      onClick={() => onRemoveLine(line.id)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div className="flex h-16 shrink-0 items-center justify-between border-t bg-muted/20 px-4">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatChf(total)}</span>
      </div>
      <div className={cn("grid shrink-0 gap-3 border-t bg-background p-4", showBookAction ? "grid-cols-2" : "grid-cols-1")}>
        {showBookAction ? (
          <Button
            variant="outline"
            className="h-12 text-base font-semibold"
            disabled={lines.length === 0 || isSubmitting}
            onClick={onCreateOrder}
          >
            {isSubmitting ? "Speichern..." : bookLabel}
          </Button>
        ) : null}
        <Button
          className="h-12 bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
          disabled={lines.length === 0 || isSubmitting}
          onClick={onStartPayment}
        >
          {payLabel}
        </Button>
      </div>
    </aside>
  );
}
