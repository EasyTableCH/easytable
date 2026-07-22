import { GiftIcon, MinusIcon, ReceiptTextIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent } from "@easytable/ui/components/card";
import { cn } from "@easytable/ui/lib/utils";

import type { BasketLine } from "../../../lib/local-master";
import { formatChf } from "../utils";

type StaffBasketProps = {
  lines: BasketLine[];
  total: number;
  isSubmitting: boolean;
  compact?: boolean;
  onDecreaseLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onOfferLine: (lineId: string) => void;
  onUndoOfferLine: (lineId: string) => void;
  onCreateOrder: () => void;
};

export function StaffBasket({
  lines,
  total,
  isSubmitting,
  compact = false,
  onDecreaseLine,
  onRemoveLine,
  onOfferLine,
  onUndoOfferLine,
  onCreateOrder,
}: StaffBasketProps) {
  return (
    <aside className={cn("flex min-h-0 flex-col overflow-hidden bg-white", compact ? "h-full" : "border-l border-slate-200")}>
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", compact ? "px-4 py-3" : "px-4 py-4")}>
        {lines.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
            <ReceiptTextIcon className="mb-3 size-12 text-slate-300" />
            <p className="text-base font-black text-slate-400">Warenkorb leer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <Card key={line.id} className="rounded-md bg-slate-50 py-0 ring-slate-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {line.quantity}x {line.product_name}
                      </p>
                      {line.variants.length > 0 ? (
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">
                          {line.variants.map((variant) => variant.variant_item_name).join(", ")}
                        </p>
                      ) : null}
                      {line.complimentary_quantity > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-700">
                          <GiftIcon className="size-3.5 shrink-0" />
                          <span className="min-w-32 flex-1">{line.quantity - line.complimentary_quantity} berechnet · {line.complimentary_quantity} offeriert ({formatChf(line.complimentary_value)})</span>
                          <Button className="h-7 shrink-0 px-2 text-xs" onClick={() => onUndoOfferLine(line.id)} size="sm" variant="ghost"><RotateCcwIcon className="size-3.5" /> Zurück</Button>
                        </div>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-950">{formatChf(line.line_total)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-md bg-white text-xs font-black uppercase text-slate-600 transition active:scale-[0.98]"
                      onClick={() => onDecreaseLine(line.id)}
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-md border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      disabled={line.complimentary_quantity >= line.quantity}
                      onClick={() => onOfferLine(line.id)}
                    >
                      <GiftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      className="h-10 rounded-md border border-red-100 bg-red-50 text-xs font-black uppercase text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
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
      <div className="flex h-14 shrink-0 items-center justify-between border-t border-slate-200 px-4 text-sm font-black">
        <div><span>Total</span><p className="text-xs text-emerald-700">Offeriert {formatChf(lines.reduce((sum, line) => sum + line.complimentary_value, 0))}</p></div>
        <span>{formatChf(total)}</span>
      </div>
      <Button
        className={cn(
          "h-16 shrink-0 rounded-none bg-amber-300 text-base font-black uppercase text-amber-900 transition hover:bg-amber-300 active:bg-amber-400",
          "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400",
        )}
        disabled={lines.length === 0 || isSubmitting}
        onClick={onCreateOrder}
      >
        {isSubmitting ? "Speichern..." : "Buchen"}
      </Button>
    </aside>
  );
}
