import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@easytable/ui/components/drawer";

import { formatChf, formatPriceDelta } from "../../lib/money";
import type {
  ProductCard,
  ProductVariantGroup,
  ProductVariantGroupItem,
} from "../../lib/pos-types";

type VariantSelectionDrawerProps = {
  open: boolean;
  product: ProductCard | null;
  groups: ProductVariantGroup[];
  activeStep: number;
  selectedItemsByGroupId: Record<string, ProductVariantGroupItem>;
  unitTotal: number;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onPrimaryAction: () => void;
  onSelectItem: (
    group: ProductVariantGroup,
    item: ProductVariantGroupItem,
  ) => void;
};

export function VariantSelectionDrawer({
  open,
  product,
  groups,
  activeStep,
  selectedItemsByGroupId,
  unitTotal,
  onOpenChange,
  onBack,
  onPrimaryAction,
  onSelectItem,
}: VariantSelectionDrawerProps) {
  const isOverviewStep = activeStep === groups.length;
  const activeGroup = groups[activeStep];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[min(76svh,44rem)] max-h-[76svh] rounded-t-md bg-[#fbfbfe]">
        {product ? (
          <>
            <DrawerHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-center">
              <DrawerTitle className="text-base font-black">
                {product.name}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Varianten fur {product.name}
              </DrawerDescription>
              <div className="mt-4 flex gap-2">
                {Array.from({ length: groups.length + 1 }).map((_, index) => (
                  <div
                    key={index}
                    className={[
                      "h-1.5 flex-1 rounded-full",
                      index <= activeStep ? "bg-indigo-800" : "bg-slate-200",
                    ].join(" ")}
                  />
                ))}
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {isOverviewStep ? (
                <VariantOverview
                  groups={groups}
                  selectedItemsByGroupId={selectedItemsByGroupId}
                />
              ) : activeGroup ? (
                <VariantGroupStep
                  group={activeGroup}
                  selectedItem={selectedItemsByGroupId[activeGroup.id]}
                  onSelect={onSelectItem}
                />
              ) : null}
            </div>

            <DrawerFooter className="shrink-0 border-t border-slate-200 p-4">
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-slate-500">Preis</span>
                <span>{formatChf(unitTotal)}</span>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <button
                  className="flex h-12 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-sm transition active:scale-[0.98]"
                  onClick={onBack}
                >
                  <ChevronLeftIcon className="size-5" />
                  Zuruck
                </button>
                <button
                  className="h-12 rounded-md bg-indigo-800 text-sm font-black text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300"
                  disabled={
                    Boolean(activeGroup?.is_required) &&
                    !selectedItemsByGroupId[activeGroup.id]
                  }
                  onClick={onPrimaryAction}
                >
                  {isOverviewStep ? "In den Warenkorb" : "Zur Ubersicht"}
                </button>
              </div>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function VariantGroupStep({
  group,
  selectedItem,
  onSelect,
}: {
  group: ProductVariantGroup;
  selectedItem?: ProductVariantGroupItem;
  onSelect: (
    group: ProductVariantGroup,
    item: ProductVariantGroupItem,
  ) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-black text-slate-950">{group.name}</h2>
        {group.is_required ? (
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">
            Pflichtfeld
          </span>
        ) : null}
        <span className="text-xs font-bold text-slate-400">
          Nur eine Auswahl
        </span>
      </div>

      <div className="space-y-3">
        {group.items.map((item) => {
          const selected = selectedItem?.id === item.id;

          return (
            <button
              key={item.id}
              className={[
                "flex min-h-16 w-full items-center justify-between gap-4 rounded-md border bg-white px-4 text-left shadow-sm transition active:scale-[0.99]",
                selected ? "border-indigo-700" : "border-slate-200",
              ].join(" ")}
              onClick={() => onSelect(group, item)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-indigo-800 bg-indigo-800 text-white"
                      : "border-slate-300 text-transparent",
                  ].join(" ")}
                >
                  <CheckIcon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {item.name}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {formatPriceDelta(item.price_delta)}
                  </p>
                </div>
              </div>
              <span
                className={[
                  "size-5 shrink-0 rounded-full border",
                  selected
                    ? "border-[6px] border-indigo-800"
                    : "border-slate-300",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function VariantOverview({
  groups,
  selectedItemsByGroupId,
}: {
  groups: ProductVariantGroup[];
  selectedItemsByGroupId: Record<string, ProductVariantGroupItem>;
}) {
  return (
    <section>
      <h2 className="mb-5 text-base font-black text-slate-950">
        Deine Auswahl
      </h2>
      <div className="space-y-3">
        {groups.map((group) => {
          const selectedItem = selectedItemsByGroupId[group.id];

          return (
            <div
              key={group.id}
              className="flex min-h-16 items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">
                  {group.name}
                </p>
                <p className="truncate text-sm font-bold text-slate-700">
                  {selectedItem?.name ?? "Keine Auswahl"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-black text-slate-500">
                {formatPriceDelta(selectedItem?.price_delta ?? 0)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
