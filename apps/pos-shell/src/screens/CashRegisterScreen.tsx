import {
  ArrowLeftIcon,
  BoxesIcon,
  LayoutGridIcon,
  ListIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@easytable/ui/components/card";

import type { PosScreen } from "../App";
import {
  completeCashPayment,
  reconcilePaymentAttempt,
  createClientRequestId,
  createOrderSnapshot,
  getPaymentAttempt,
  getStoredTerminalConfig,
  loadOpenTableOrderBasket,
  loadPosSettings,
  loadProductVariantGroups,
  loadProducts as loadCatalogProducts,
  startWalleeTerminalPayment,
  subscribeLocalMasterEvents,
} from "../lib/local-master-client";
import { formatChf } from "../lib/money";
import type {
  BasketLine,
  BasketLineVariant,
  PaymentRequest,
  PosProduct,
  ProductCard,
  ProductVariantGroup,
  ProductVariantGroupItem,
  LocationServiceMode,
  PosSettingsFile,
  TableContext,
} from "../lib/pos-types";
import { BasketPanel } from "./cash-register/BasketPanel";
import { PaymentScreen } from "./cash-register/PaymentScreen";
import { VariantSelectionDrawer } from "./cash-register/VariantSelectionDrawer";
import {
  buildSelectedBasketVariants,
  getDefaultSelections,
} from "./cash-register/variantSelection";
import { PosBottomNav } from "./PosBottomNav";

type CashRegisterScreenProps = {
  serviceMode: LocationServiceMode;
  tableContext: TableContext | null;
  onNavigate: (screen: PosScreen) => void;
  onOrderCreated: () => void;
};

const allCategoryLabel = "Alle";
const pendingWalleeAttemptStorageKey = "easytable.pending-wallee-attempt";
type CatalogViewMode = "grid" | "list";

export function CashRegisterScreen({
  serviceMode,
  tableContext,
  onNavigate,
  onOrderCreated,
}: CashRegisterScreenProps) {
  const showTopRegion = true;
  const isCounterService = serviceMode === "COUNTER_SERVICE";
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [paymentLoaderMessage, setPaymentLoaderMessage] = useState("Zahlung wird verarbeitet");
  const [selectedCategory, setSelectedCategory] = useState(allCategoryLabel);
  const [catalogViewMode, setCatalogViewMode] =
    useState<CatalogViewMode>("grid");
  const [basketLines, setBasketLines] = useState<BasketLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductCard | null>(
    null,
  );
  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>([]);
  const [activeVariantStep, setActiveVariantStep] = useState(0);
  const [selectedVariantItemsByGroupId, setSelectedVariantItemsByGroupId] =
    useState<Record<string, ProductVariantGroupItem>>({});
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCompletingPayment, setIsCompletingPayment] = useState(false);
  const [pendingPaymentAttemptId, setPendingPaymentAttemptId] = useState<string | null>(null);
  const [isPaymentScreenOpen, setIsPaymentScreenOpen] = useState(false);
  const [settingsFile, setSettingsFile] = useState<PosSettingsFile | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const databaseProducts = await loadCatalogProducts();
      setProducts(databaseProducts);
    } catch (error) {
      console.warn("Could not load products from Local Master.", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialProducts() {
      try {
        const [databaseProducts, loadedSettings] = await Promise.all([
          loadCatalogProducts(),
          loadPosSettings(),
        ]);

        if (isMounted) {
          setProducts(databaseProducts);
          setSettingsFile(loadedSettings);
        }
      } catch (error) {
        console.warn("Could not load products from Local Master.", error);
      }
    }

    void loadInitialProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const storedAttemptId = window.localStorage.getItem(pendingWalleeAttemptStorageKey);
    if (!storedAttemptId) return;
    const attemptId: string = storedAttemptId;
    let cancelled = false;
    setPendingPaymentAttemptId(attemptId);
    toast.info("Offene Terminalzahlung wird wieder aufgenommen.");

    async function resumePayment() {
      try {
        let attempt = await getPaymentAttempt(attemptId);
        if (attempt.reconciliation_required) attempt = await reconcilePaymentAttempt(attemptId);
        if (cancelled) return;
        if (attempt.lifecycle_state === "completed") {
          clearPendingWalleeAttempt();
          setPendingPaymentAttemptId(null);
          setBasketLines([]);
          setIsPaymentScreenOpen(false);
          toast.success("Terminalzahlung wurde bestätigt.");
          onOrderCreated();
        } else if (attempt.lifecycle_state === "cancelled") {
          clearPendingWalleeAttempt();
          setPendingPaymentAttemptId(null);
          setIsPaymentScreenOpen(false);
          toast.info("Terminalzahlung wurde abgebrochen.");
        } else if (["declined", "failed"].includes(attempt.lifecycle_state)) {
          clearPendingWalleeAttempt();
          setPendingPaymentAttemptId(null);
          toast.error(attempt.failure_reason ?? "Terminalzahlung wurde nicht abgeschlossen.");
        } else {
          toast.info("Terminalzahlung wird weiterhin geprüft. Bitte keine zweite Zahlung starten.");
        }
      } catch {
        if (!cancelled) toast.info("Offene Terminalzahlung wird durch LocalMaster weiter geprüft.");
      }
    }

    void resumePayment();
    return () => { cancelled = true; };
  }, [onOrderCreated]);

  useEffect(() => {
    return subscribeLocalMasterEvents((event) => {
      if (event.type === "CATALOG_UPDATED") {
        void loadProducts();
      }
    });
  }, [loadProducts]);

  useEffect(() => {
    let isMounted = true;

    async function loadOpenTableBasket() {
      if (!tableContext) {
        setBasketLines([]);
        return;
      }

      setBasketLines([]);
      setIsPaymentScreenOpen(false);

      try {
        const openBasket = await loadOpenTableOrderBasket(tableContext.table_id);

        if (isMounted) {
          setBasketLines(openBasket?.lines ?? []);
        }
      } catch (error) {
        console.warn("Could not load open table basket.", error);

        if (isMounted) {
          setBasketLines([]);
          toast.error("Offener Tischauftrag konnte nicht geladen werden.");
        }
      }
    }

    void loadOpenTableBasket();

    return () => {
      isMounted = false;
    };
  }, [tableContext]);

  const productCards = useMemo<ProductCard[]>(() => products, [products]);

  const productCategories = useMemo(
    () => [
      allCategoryLabel,
      ...Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter((category) => category.trim().length > 0),
        ),
      ),
    ],
    [products],
  );

  const filteredProductCards = useMemo(
    () =>
      selectedCategory === allCategoryLabel
        ? productCards
        : productCards.filter((product) => product.category === selectedCategory),
    [productCards, selectedCategory],
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
  const isWalleeTerminalEnabled =
    settingsFile?.settings.payment_terminal.enabled === true &&
    settingsFile.settings.payment_terminal.provider === "wallee_cloud_till";

  async function handleProductPress(product: ProductCard) {
    try {
      const groups = await loadProductVariantGroups(product.id);

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

  async function handleCreateOrderSnapshot() {
    if (basketLines.length === 0 || isCreatingOrder || isCompletingPayment) {
      return;
    }

    if (!tableContext) {
      toast.error("Bitte zuerst einen Tisch auswahlen.");
      return;
    }

    setIsCreatingOrder(true);

    try {
      const order = await createOrderSnapshot({
        request_id: createClientRequestId("order_snapshot"),
        lines: basketLines,
        table_context: tableContext,
      });

      setBasketLines([]);
      toast.success(`Auftrag ${order.order_number} wurde gespeichert.`);
      onOrderCreated();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Auftrag konnte nicht gespeichert werden.",
      );
    } finally {
      setIsCreatingOrder(false);
    }
  }

  function handleStartPayment() {
    if (basketLines.length === 0 || isCreatingOrder || isCompletingPayment) {
      return;
    }

    if (!tableContext && !isCounterService) {
      toast.error("Bitte zuerst einen Tisch auswahlen.");
      return;
    }

    setIsPaymentScreenOpen(true);
  }

  async function handleCompletePayment(paymentRequest: PaymentRequest) {
    if (basketLines.length === 0 || isCompletingPayment || pendingPaymentAttemptId) {
      if (pendingPaymentAttemptId) {
        toast.info("Eine Terminalzahlung wird noch geprüft. Bitte keine zweite Zahlung starten.");
      }
      return;
    }

    if (!tableContext && !isCounterService) {
      return;
    }

    setIsCompletingPayment(true);
    setPaymentLoaderMessage("Zahlung wird verarbeitet");

    try {
      const requestId = createClientRequestId("payment");
      const terminalId = getStoredTerminalConfig()?.terminalId ?? "pos-shell";
      const payment =
        paymentRequest.payment_method === "WALLEE_TERMINAL"
          ? await startWalleeTerminalPayment({
            lines: basketLines,
            table_context: tableContext,
            request_id: requestId,
            pos_terminal_id: terminalId,
          })
          : await completeCashPayment({
            lines: basketLines,
            table_context: tableContext,
            request_id: requestId,
            terminal_id: terminalId,
            ...paymentRequest,
          });

      if (payment.lifecycle_state !== "completed") {
        if (payment.reconciliation_required && payment.payment_attempt_id) {
          setPendingPaymentAttemptId(payment.payment_attempt_id);
          window.localStorage.setItem(pendingWalleeAttemptStorageKey, payment.payment_attempt_id);
          toast.info("Terminalzahlung wird geprüft. Bitte keine zweite Zahlung starten.");
          try {
            const reconciled = await reconcilePaymentAttempt(payment.payment_attempt_id);
            if (reconciled.lifecycle_state === "completed") {
              setBasketLines([]);
              setPendingPaymentAttemptId(null);
              clearPendingWalleeAttempt();
              setIsPaymentScreenOpen(false);
              toast.success("Terminalzahlung wurde bestätigt.");
              onOrderCreated();
            }
          } catch {
            // LocalMaster recovery continues independently; keep the attempt locked in the POS.
          }
          return;
        }
        if (payment.lifecycle_state === "cancelled") {
          clearPendingWalleeAttempt();
          setPendingPaymentAttemptId(null);
          setPaymentLoaderMessage("Transaktion abgelehnt");
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          setIsPaymentScreenOpen(false);
          return;
        }
        throw new Error(payment.failure_reason ?? "Zahlung wurde nicht abgeschlossen.");
      }

      setBasketLines([]);
      setIsPaymentScreenOpen(false);
      toast.success(
        `Auftrag ${payment.order_number} wurde bezahlt (${formatChf(payment.amount)}).`,
      );
      onOrderCreated();
    } catch (error) {
      setIsPaymentScreenOpen(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Zahlung konnte nicht abgeschlossen werden.",
      );
    } finally {
      setIsCompletingPayment(false);
    }
  }

  if (isPaymentScreenOpen) {
    return (
      <PaymentScreen
        total={basketTotal}
        isSubmitting={isCompletingPayment}
        submittingMessage={paymentLoaderMessage}
        isWalleeTerminalEnabled={isWalleeTerminalEnabled}
        onCancel={() => setIsPaymentScreenOpen(false)}
        onSelectMethod={(payment) => void handleCompletePayment(payment)}
      />
    );
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
                onClick={() => onNavigate("tables")}
              >
                <ArrowLeftIcon className="size-5" />
              </button>
              <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {productCategories.map((category) => (
                  <button
                    key={category}
                    className={[
                      "h-10 shrink-0 rounded-[2rem] px-4 text-sm font-extrabold uppercase tracking-normal transition active:scale-[0.98]",
                      category === selectedCategory
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                        : "bg-slate-100 text-slate-500 active:bg-slate-200",
                    ].join(" ")}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </nav>
            </section>

            {tableContext ? (
              <aside className="flex min-w-0 items-center border-l bg-background px-5">
                <p className="truncate text-sm font-semibold text-foreground">
                  Tisch {tableContext.table_name}
                </p>
              </aside>
            ) : null}
          </div>
        </header>
      ) : null}

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(15rem,24vw,22rem)] overflow-hidden">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Produkte</p>
              <p className="text-xs text-muted-foreground">{filteredProductCards.length} in dieser Ansicht</p>
            </div>
            <div className="grid h-11 grid-cols-2 rounded-lg bg-muted p-1">
              <button
                className={[
                  "flex min-w-24 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition active:scale-[0.98]",
                  catalogViewMode === "grid"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setCatalogViewMode("grid")}
              >
                <LayoutGridIcon className="size-5" />
                Raster
              </button>
              <button
                className={[
                  "flex min-w-24 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition active:scale-[0.98]",
                  catalogViewMode === "list"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setCatalogViewMode("list")}
              >
                <ListIcon className="size-5" />
                Liste
              </button>
            </div>
          </div>

          {catalogViewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-6">
              {filteredProductCards.map((product) => (
                <button
                  key={product.id}
                  className="group aspect-square min-h-56 text-left transition active:scale-[0.975]"
                  onClick={() => void handleProductPress(product)}
                >
                  <Card className="h-full gap-0 overflow-hidden rounded-2xl py-0 shadow-xl transition group-hover:-translate-y-0.5 group-hover:shadow-md group-active:bg-muted/30">
                  <div className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/40">
                    <BoxesIcon className="size-14 text-slate-950" strokeWidth={1.75} />
                  </div>
                  <CardContent className="flex min-h-20 items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {formatChf(product.price)}
                      </p>
                    </div>
                  </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredProductCards.map((product) => (
                <button
                  key={product.id}
                  className="group flex min-h-20 items-center gap-4 rounded-xl bg-card px-4 text-left shadow-sm ring-1 ring-foreground/10 transition hover:bg-muted/30 active:scale-[0.985] active:bg-muted"
                  onClick={() => void handleProductPress(product)}
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-foreground/5">
                    <BoxesIcon className="size-7 text-slate-950" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">
                      {product.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {product.category}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-foreground">
                    {formatChf(product.price)}
                  </p>
                </button>
              ))}
            </div>
          )}

          {filteredProductCards.length === 0 ? (
            <div className="flex min-h-[45svh] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/60 px-6 text-center">
              <p className="max-w-sm text-sm font-black uppercase text-slate-400">
                Keine Produkte im Katalog
              </p>
            </div>
          ) : null}
        </div>

        <BasketPanel
          lines={basketLines}
          total={basketTotal}
          isSubmitting={isCreatingOrder || isCompletingPayment}
          bookLabel="Buchen"
          payLabel="Bezahlen"
          showBookAction={!isCounterService}
          onDecreaseLine={decreaseBasketLine}
          onRemoveLine={removeBasketLine}
          onCreateOrder={() => void handleCreateOrderSnapshot()}
          onStartPayment={handleStartPayment}
        />
      </section>

      <PosBottomNav activeScreen="cash" onNavigate={onNavigate} />

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

function clearPendingWalleeAttempt() {
  window.localStorage.removeItem(pendingWalleeAttemptStorageKey);
}


