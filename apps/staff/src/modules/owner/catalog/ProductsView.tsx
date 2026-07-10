import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@easytable/ui/components/badge";
import { Button } from "@easytable/ui/components/button";
import { Switch } from "@easytable/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@easytable/ui/components/table";

import type { CatalogCategory, CatalogOutputStation, CatalogProduct, CatalogProductInput, CatalogTax, ProductVariantGroup, ProductVariantGroupInput } from "../../../lib/local-master";
import { CatalogFilters } from "./components/CatalogFilters";
import { DuplicateIconButton, ProductFormDialog } from "./components/ProductFormDialog";
import { VariantGroupsSheet } from "./components/VariantGroupsSheet";
import { formatMoney } from "./utils";

type ProductsViewProps = {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  outputStations: CatalogOutputStation[];
  taxes: CatalogTax[];
  isLoading: boolean;
  onReload: () => void;
  onCreate: (input: CatalogProductInput) => Promise<void>;
  onUpdate: (productId: string, input: Partial<CatalogProductInput>) => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
  onDuplicate: (productId: string) => Promise<void>;
  variantGroups: ProductVariantGroup[];
  onCreateVariantGroup: (input: ProductVariantGroupInput) => Promise<void>;
  onUpdateVariantGroup: (groupId: string, input: ProductVariantGroupInput) => Promise<void>;
  onDeleteVariantGroup: (groupId: string) => Promise<void>;
};

export function ProductsView({
  products,
  categories,
  outputStations,
  taxes,
  isLoading,
  onReload,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  variantGroups,
  onCreateVariantGroup,
  onUpdateVariantGroup,
  onDeleteVariantGroup,
}: ProductsViewProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [station, setStation] = useState("all");
  const [type, setType] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [updatingStatusProductId, setUpdatingStatusProductId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        [product.name, product.category, product.station_name ?? "", product.tax_code_name, product.product_type]
          .some((value) => value.toLowerCase().includes(query));
      const matchesCategory = categoryId === "all" || product.category_id === categoryId;
      const matchesStation =
        station === "all" ||
        (station === "none" ? product.station_id === null : product.station_id === station);
      const matchesType = type === "all" || product.product_type === type;
      const matchesAvailability =
        availability === "all" ||
        (availability === "available" ? product.is_available : !product.is_available);

      return matchesSearch && matchesCategory && matchesStation && matchesType && matchesAvailability;
    });
  }, [availability, categoryId, products, search, station, type]);

  async function handleDelete(product: CatalogProduct) {
    if (!window.confirm(`Produkt "${product.name}" löschen?`)) {
      return;
    }

    await onDelete(product.id);
  }

  async function handleAvailabilityChange(product: CatalogProduct, isAvailable: boolean) {
    setUpdatingStatusProductId(product.id);

    try {
      await onUpdate(product.id, { is_available: isAvailable });
    } finally {
      setUpdatingStatusProductId(null);
    }
  }

  return (
    <section className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Produkte</h2>
          <p className="text-sm text-muted-foreground">Produkte erstellen, bearbeiten, kopieren und filtern.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isLoading} onClick={onReload} type="button" variant="outline">
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Laden
          </Button>
          <ProductFormDialog categories={categories} mode="create" onSubmit={onCreate} outputStations={outputStations} taxes={taxes} />
        </div>
      </div>

      <CatalogFilters
        filters={[
          {
            id: "category",
            label: "Kategorie",
            value: categoryId,
            onChange: setCategoryId,
            options: [
              { label: "Alle Kategorien", value: "all" },
              ...categories.map((category) => ({ label: category.name, value: category.id })),
            ],
          },
          {
            id: "station",
            label: "Station",
            value: station,
            onChange: setStation,
            options: [
              { label: "Alle Stationen", value: "all" },
              { label: "Keine Station", value: "none" },
              ...outputStations.map((option) => ({ label: option.name, value: option.id })),
            ],
          },
          {
            id: "type",
            label: "Typ",
            value: type,
            onChange: setType,
            options: [
              { label: "Alle Typen", value: "all" },
              { label: "BASIC", value: "BASIC" },
              { label: "SERVICE", value: "SERVICE" },
            ],
          },
          {
            id: "availability",
            label: "Verfügbarkeit",
            value: availability,
            onChange: setAvailability,
            options: [
              { label: "Alle Status", value: "all" },
              { label: "Verfügbar", value: "available" },
              { label: "Nicht verfügbar", value: "unavailable" },
            ],
          },
        ]}
        onSearchChange={setSearch}
        search={search}
        searchPlaceholder="Produkt, Kategorie, Steuer oder Station suchen"
      />

      <div className="p-2 sm:p-3">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead>Steuer</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.product_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(product.price)}</TableCell>
                  <TableCell>{product.tax_code_name}</TableCell>
                  <TableCell>{product.station_name ?? "Keine Station"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_available}
                        disabled={updatingStatusProductId === product.id}
                        onCheckedChange={(checked) => void handleAvailabilityChange(product, checked)}
                        size="sm"
                      />
                      <span className="text-sm text-muted-foreground">{product.is_available ? "Verfügbar" : "Aus"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <VariantGroupsSheet groups={variantGroups} mode="PRODUCT" product={product} onCreate={onCreateVariantGroup} onUpdate={onUpdateVariantGroup} onDelete={onDeleteVariantGroup} />
                      <ProductFormDialog
                        categories={categories}
                        mode="edit"
                        outputStations={outputStations}
                        taxes={taxes}
                        onSubmit={(input) => onUpdate(product.id, input)}
                        product={product}
                      />
                      <DuplicateIconButton onClick={() => void onDuplicate(product.id)} />
                      <Button onClick={() => void handleDelete(product)} size="icon-sm" title="Loeschen" type="button" variant="ghost">
                        <Trash2 className="size-4" />
                        <span className="sr-only">Löschen</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>
                    Keine Produkte gefunden.
                  </TableCell>
                </TableRow>
              ) : null}

              {isLoading ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={8}>
                    Produkte werden geladen.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
