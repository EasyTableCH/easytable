import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  detectConnectionMode,
  loadOwnerCatalogForConnection,
  loadOwnerProductVariantGroups,
  runOwnerCatalogActionForConnection,
  subscribeConnectionEvents,
  type CatalogCategory,
  type CatalogOutputStation,
  type CatalogProduct,
  type CatalogTax,
  type ProductVariantGroup,
  type ProductVariantGroupInput,
  type ConnectionMode,
} from "../../../lib/local-master";
import type { OwnerCatalogSection } from "../../../layout/navigation";
import { CategoriesView } from "./CategoriesView";
import { ProductsView } from "./ProductsView";
import { TaxView } from "./TaxView";

type OwnerCatalogPageProps = {
  section: OwnerCatalogSection;
};

export function OwnerCatalogPage({ section }: OwnerCatalogPageProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [outputStations, setOutputStations] = useState<CatalogOutputStation[]>([]);
  const [taxes, setTaxes] = useState<CatalogTax[]>([]);
  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("OFFLINE");

  const refreshCatalog = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextMode = await detectConnectionMode();
      setConnectionMode(nextMode);
      const snapshot = await loadOwnerCatalogForConnection(nextMode);
      setProducts(snapshot.products);
      setCategories(snapshot.categories);
      setTaxes(snapshot.taxes);
      setOutputStations(snapshot.output_stations);
      setVariantGroups(await loadOwnerProductVariantGroups());
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Katalog konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function runAction(action: string, payload: unknown) {
    try {
      await runOwnerCatalogActionForConnection(connectionMode, action, payload);
      await refreshCatalog();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Aktion fehlgeschlagen.");
      throw actionError;
    }
  }

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (connectionMode === "OFFLINE") {
      return undefined;
    }

    return subscribeConnectionEvents(connectionMode, (event) => {
      if (event.type === "CATALOG_UPDATED") {
        void refreshCatalog();
      }
    });
  }, [connectionMode, refreshCatalog]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {section === "products" ? (
        <ProductsView
          categories={categories}
          isLoading={isLoading}
          onCreate={(input) => runAction("OWNER_CATALOG_PRODUCT_CREATE", input)}
          onDelete={(productId) => runAction("OWNER_CATALOG_PRODUCT_DELETE", { product_id: productId })}
          onDuplicate={(productId) => runAction("OWNER_CATALOG_PRODUCT_DUPLICATE", { product_id: productId })}
          onReload={refreshCatalog}
          onUpdate={(productId, input) => runAction("OWNER_CATALOG_PRODUCT_UPDATE", { product_id: productId, input })}
          outputStations={outputStations}
          products={products}
          taxes={taxes}
          variantGroups={variantGroups}
          onCreateVariantGroup={(input: ProductVariantGroupInput) => runAction("OWNER_CATALOG_VARIANT_GROUP_CREATE", input)}
          onUpdateVariantGroup={(groupId: string, input: ProductVariantGroupInput) => runAction("OWNER_CATALOG_VARIANT_GROUP_UPDATE", { group_id: groupId, input })}
          onDeleteVariantGroup={(groupId: string) => runAction("OWNER_CATALOG_VARIANT_GROUP_DELETE", { group_id: groupId })}
        />
      ) : section === "categories" ? (
        <CategoriesView
          categories={categories}
          isLoading={isLoading}
          onCreate={(input) => runAction("OWNER_CATALOG_CATEGORY_CREATE", input)}
          onDelete={(categoryId) => runAction("OWNER_CATALOG_CATEGORY_DELETE", { category_id: categoryId })}
          onDuplicate={(categoryId) => runAction("OWNER_CATALOG_CATEGORY_DUPLICATE", { category_id: categoryId })}
          onReload={refreshCatalog}
          onUpdate={(categoryId, input) => runAction("OWNER_CATALOG_CATEGORY_UPDATE", { category_id: categoryId, input })}
          outputStations={outputStations}
          variantGroups={variantGroups}
          onCreateVariantGroup={(input: ProductVariantGroupInput) => runAction("OWNER_CATALOG_VARIANT_GROUP_CREATE", input)}
          onUpdateVariantGroup={(groupId: string, input: ProductVariantGroupInput) => runAction("OWNER_CATALOG_VARIANT_GROUP_UPDATE", { group_id: groupId, input })}
          onDeleteVariantGroup={(groupId: string) => runAction("OWNER_CATALOG_VARIANT_GROUP_DELETE", { group_id: groupId })}
        />
      ) : (
        <TaxView
          isLoading={isLoading}
          onCreate={(input) => runAction("OWNER_CATALOG_TAX_CREATE", input)}
          onDelete={(taxId) => runAction("OWNER_CATALOG_TAX_DELETE", { tax_id: taxId })}
          onDuplicate={(taxId) => runAction("OWNER_CATALOG_TAX_DUPLICATE", { tax_id: taxId })}
          onReload={refreshCatalog}
          onUpdate={(taxId, input) => runAction("OWNER_CATALOG_TAX_UPDATE", { tax_id: taxId, input })}
          taxes={taxes}
        />
      )}
    </div>
  );
}
