import { getProductById, listProducts as listCatalogProducts } from "../catalogStore.js";
import { variantGroups } from "./storeSeeds.js";

export function listProducts() {
  return listCatalogProducts().filter((product) => product.is_available);
}

export function listProductVariantGroups(productId: string) {
  const product = getProductById(productId);

  if (!product || product.product_type !== "BASIC") {
    return [];
  }

  return variantGroups
    .filter((group) =>
      group.applies_to === "PRODUCT"
        ? group.product_id === product.id
        : group.category === product.category
    )
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
}
