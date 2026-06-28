import { MinusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react";

import { formatChf } from "../../lib/money";
import type { BasketLine } from "../../lib/pos-types";

type BasketPanelProps = {
  lines: BasketLine[];
  total: number;
  onDecreaseLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
};

export function BasketPanel({
  lines,
  total,
  onDecreaseLine,
  onRemoveLine,
}: BasketPanelProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ReceiptTextIcon className="mb-4 size-14 text-slate-300" />
            <p className="text-base font-black text-slate-400">
              Warenkorb leer
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">
                      {line.quantity}x {line.product_name}
                    </p>
                    {line.variants.length > 0 ? (
                      <p className="mt-1 truncate text-xs font-bold text-slate-500">
                        {line.variants
                          .map((variant) => variant.variant_item_name)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-black text-slate-950">
                    {formatChf(line.line_total)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 transition active:scale-[0.98] active:bg-slate-100"
                    onClick={() => onDecreaseLine(line.id)}
                  >
                    <MinusIcon className="size-4" />
                  </button>
                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 text-xs font-black uppercase text-red-700 transition active:scale-[0.98] active:bg-red-100"
                    onClick={() => onRemoveLine(line.id)}
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-slate-200 px-4 text-sm font-black">
        <span>Total</span>
        <span>{formatChf(total)}</span>
      </div>
      <button className="h-18 shrink-0 bg-emerald-300 text-lg font-black uppercase text-emerald-800 transition active:bg-emerald-400 disabled:text-emerald-600">
        Bezahlen
      </button>
    </aside>
  );
}
