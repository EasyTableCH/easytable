import {
  ArrowLeftIcon,
  BoxesIcon,
  DoorOpenIcon,
  EllipsisIcon,
  LayoutGridIcon,
  SearchIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { PosScreen } from "../App";
import { formatChf } from "../lib/money";
import type {
  BasketLine,
  BasketLineVariant,
  PosProduct,
  ProductCard,
  ProductVariantGroup,
  ProductVariantGroupItem,
} from "../lib/pos-types";
import { BasketPanel } from "./cash-register/BasketPanel";
import {
  categories,
  fallbackProducts,
  productVisuals,
} from "./cash-register/catalogData";
import { VariantSelectionDrawer } from "./cash-register/VariantSelectionDrawer";
import {
  buildSelectedBasketVariants,
  getDefaultSelections,
} from "./cash-register/variantSelection";

type CashRegisterScreenProps = {
  onNavigate: (screen: PosScreen) => void;
};

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
  const [products, setProducts] = useState<PosProduct[]>(fallbackProducts);
  const [basketLines, setBasketLines] = useState<BasketLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductCard | null>(
    null,
  );
  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>([]);
  const [activeVariantStep, setActiveVariantStep] = useState(0);
  const [selectedVariantItemsByGroupId, setSelectedVariantItemsByGroupId] =
    useState<Record<string, ProductVariantGroupItem>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        await invoke("initialize_pos_database");
        const databaseProducts = await invoke<PosProduct[]>("list_products");

        if (isMounted && databaseProducts.length > 0) {
          setProducts(databaseProducts);
        }
      } catch (error) {
        console.warn(
          "Using fallback products because SQLite is unavailable.",
          error,
        );
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const productCards = useMemo<ProductCard[]>(
    () =>
      products.map((product, index) => ({
        ...product,
        ...productVisuals[index % productVisuals.length],
      })),
    [products],
  );

  const basketTotal = basketLines.reduce(
    (total, line) => total + line.line_total,
    0,
  );
  const selectedVariantTotal = Object.values(
    selectedVariantItemsByGroupId,
  ).reduce((total, item) => total + item.price_delta, 0);
  const drawerUnitTotal = selectedProduct
    ? selectedProduct.price + selectedVariantTotal
    : 0;

  async function handleProductPress(product: ProductCard) {
    try {
      const groups = await invoke<ProductVariantGroup[]>(
        "list_product_variant_groups",
        {
          productId: product.id,
        },
      );

      if (groups.length === 0) {
        addProductToBasket(product, []);
        return;
      }

      openVariantDrawer(product, groups);
    } catch (error) {
      console.warn("Adding product without variants after lookup failed.", error);
      addProductToBasket(product, []);
    }
  }

  function openVariantDrawer(product: ProductCard, groups: ProductVariantGroup[]) {
    setSelectedProduct(product);
    setVariantGroups(groups);
    setActiveVariantStep(0);
    setSelectedVariantItemsByGroupId(getDefaultSelections(groups));
  }

  function closeVariantDrawer() {
    setSelectedProduct(null);
    setVariantGroups([]);
    setActiveVariantStep(0);
    setSelectedVariantItemsByGroupId({});
  }

  function handleDrawerOpenChange(open: boolean) {
    if (!open) {
      closeVariantDrawer();
    }
  }

  function handleVariantBack() {
    if (activeVariantStep === 0) {
      closeVariantDrawer();
      return;
    }

    setActiveVariantStep((current) => current - 1);
  }

  function handlePrimaryDrawerAction() {
    if (!selectedProduct) {
      return;
    }

    if (activeVariantStep === variantGroups.length) {
      addProductToBasket(
        selectedProduct,
        buildSelectedBasketVariants(variantGroups, selectedVariantItemsByGroupId),
      );
      closeVariantDrawer();
      return;
    }

    const group = variantGroups[activeVariantStep];

    if (group.is_required && !selectedVariantItemsByGroupId[group.id]) {
      return;
    }

    setActiveVariantStep((current) => current + 1);
  }

  function handleVariantItemSelect(
    group: ProductVariantGroup,
    item: ProductVariantGroupItem,
  ) {
    if (group.selection_type !== "SINGLE") {
      return;
    }

    setSelectedVariantItemsByGroupId((current) => ({
      ...current,
      [group.id]: item,
    }));
  }

  function addProductToBasket(
    product: ProductCard,
    variants: BasketLineVariant[],
  ) {
    const unitTotal =
      product.price +
      variants.reduce((total, variant) => total + variant.price_delta, 0);
    const id = `${product.id}:${variants
      .map((variant) => variant.variant_item_id)
      .join("|")}`;

    setBasketLines((current) => {
      const existingLine = current.find((line) => line.id === id);

      if (existingLine) {
        return current.map((line) =>
          line.id === id
            ? {
                ...line,
                quantity: line.quantity + 1,
                line_total: line.unit_total * (line.quantity + 1),
              }
            : line,
        );
      }

      return [
        ...current,
        {
          id,
          product_id: product.id,
          product_type: product.product_type,
          product_name: product.name,
          product_category: product.category,
          base_price: product.price,
          tax_code_id: product.tax_code_id,
          tax_code_name: product.tax_code_name,
          tax_rate_bps: product.tax_rate_bps,
          station: product.station,
          variants,
          unit_total: unitTotal,
          quantity: 1,
          line_total: unitTotal,
        },
      ];
    });
  }

  function decreaseBasketLine(lineId: string) {
    setBasketLines((current) =>
      current.flatMap((line) => {
        if (line.id !== lineId) {
          return [line];
        }

        if (line.quantity <= 1) {
          return [];
        }

        return [
          {
            ...line,
            quantity: line.quantity - 1,
            line_total: line.unit_total * (line.quantity - 1),
          },
        ];
      }),
    );
  }

  function removeBasketLine(lineId: string) {
    setBasketLines((current) => current.filter((line) => line.id !== lineId));
  }

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
                {basketLines.length === 0
                  ? "Keine Artikel gewahlt"
                  : `${basketLines.length} Positionen`}
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
            {productCards.map((product, index) => (
              <button
                key={product.id}
                className="group flex aspect-[1.08] min-h-44 flex-col overflow-hidden rounded-md bg-white text-left shadow-md shadow-slate-200/80 ring-1 ring-slate-200 transition active:scale-[0.985]"
                onClick={() => void handleProductPress(product)}
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
                      {formatChf(product.price)}
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

        <BasketPanel
          lines={basketLines}
          total={basketTotal}
          onDecreaseLine={decreaseBasketLine}
          onRemoveLine={removeBasketLine}
        />
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

      <VariantSelectionDrawer
        open={selectedProduct !== null}
        product={selectedProduct}
        groups={variantGroups}
        activeStep={activeVariantStep}
        selectedItemsByGroupId={selectedVariantItemsByGroupId}
        unitTotal={drawerUnitTotal}
        onOpenChange={handleDrawerOpenChange}
        onBack={handleVariantBack}
        onPrimaryAction={handlePrimaryDrawerAction}
        onSelectItem={handleVariantItemSelect}
      />
    </main>
  );
}
