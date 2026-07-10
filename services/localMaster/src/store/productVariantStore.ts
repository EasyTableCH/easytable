import { randomUUID } from "node:crypto";

import { getProductById, listCatalogCategories } from "../catalogStore.js";
import type { ProductVariantGroup, ProductVariantGroupItem } from "../types.js";
import { variantGroups } from "./storeSeeds.js";

export type ProductVariantGroupInput = {
  applies_to: "PRODUCT" | "CATEGORY";
  product_id?: string | null;
  category?: string | null;
  name: string;
  selection_type?: "SINGLE" | "MULTIPLE";
  min_select?: number;
  max_select?: number;
  sort_order?: number;
  is_required?: boolean;
  items?: Array<Partial<ProductVariantGroupItem> & { name: string; price_delta?: number }>;
};

export function listOwnerProductVariantGroups() {
  return [...variantGroups].sort(sortGroups).map(cloneGroup);
}

export function listVariantGroupsForProduct(productId: string) {
  const product = getProductById(productId);

  if (!product || product.product_type !== "BASIC") {
    return [];
  }

  return variantGroups
    .filter((group) => group.applies_to === "PRODUCT" ? group.product_id === product.id : group.category === product.category)
    .sort(sortGroups)
    .map(cloneGroup);
}

export function createProductVariantGroup(input: ProductVariantGroupInput) {
  const group = normalizeGroupInput(input);
  variantGroups.push(group);
  return cloneGroup(group);
}

export function updateProductVariantGroup(groupId: string, input: Partial<ProductVariantGroupInput>) {
  const index = variantGroups.findIndex((group) => group.id === groupId);
  if (index === -1) throw new Error("Variant group not found.");

  const current = variantGroups[index];
  variantGroups[index] = normalizeGroupInput({
    applies_to: input.applies_to ?? current.applies_to,
    product_id: input.product_id === undefined ? current.product_id : input.product_id,
    category: input.category === undefined ? current.category : input.category,
    name: input.name ?? current.name,
    selection_type: input.selection_type ?? current.selection_type,
    min_select: input.min_select ?? current.min_select,
    max_select: input.max_select ?? current.max_select,
    sort_order: input.sort_order ?? current.sort_order,
    is_required: input.is_required ?? current.is_required,
    items: input.items ?? current.items
  }, current.id);

  return cloneGroup(variantGroups[index]);
}

export function deleteProductVariantGroup(groupId: string) {
  const index = variantGroups.findIndex((group) => group.id === groupId);
  if (index === -1) throw new Error("Variant group not found.");
  variantGroups.splice(index, 1);
}

export function duplicateVariantGroupsForProduct(sourceProductId: string, targetProductId: string) {
  for (const group of variantGroups.filter((entry) => entry.applies_to === "PRODUCT" && entry.product_id === sourceProductId)) {
    variantGroups.push(cloneForTarget(group, { product_id: targetProductId }));
  }
}

export function duplicateVariantGroupsForCategory(sourceCategoryName: string, targetCategoryName: string) {
  for (const group of variantGroups.filter((entry) => entry.applies_to === "CATEGORY" && entry.category === sourceCategoryName)) {
    variantGroups.push(cloneForTarget(group, { category: targetCategoryName }));
  }
}

function normalizeGroupInput(input: ProductVariantGroupInput, id = "vgrp_" + randomUUID()): ProductVariantGroup {
  const name = normalizeName(input.name, "Variantengruppen-Name ist erforderlich.");
  const appliesTo = input.applies_to;
  const product = appliesTo === "PRODUCT" ? getProductById(String(input.product_id ?? "")) : null;
  const categoryName = appliesTo === "CATEGORY" ? normalizeName(input.category ?? "", "Kategorie ist erforderlich.") : null;

  if (appliesTo === "PRODUCT" && !product) throw new Error("Produkt fuer Variantengruppe nicht gefunden.");
  if (appliesTo === "CATEGORY" && !listCatalogCategories().some((category) => category.name === categoryName)) throw new Error("Kategorie fuer Variantengruppe nicht gefunden.");

  const items = (input.items ?? []).map((item, index) => ({
    id: item.id ?? "vitem_" + randomUUID(),
    variant_group_id: id,
    name: normalizeName(item.name, "Varianten-Name ist erforderlich."),
    price_delta: normalizeCents(item.price_delta ?? 0),
    is_default: Boolean(item.is_default),
    sort_order: normalizeInteger(item.sort_order ?? (index + 1) * 10)
  }));

  return {
    id,
    applies_to: appliesTo,
    product_id: appliesTo === "PRODUCT" ? product!.id : null,
    category: appliesTo === "CATEGORY" ? categoryName : null,
    name,
    selection_type: input.selection_type ?? "SINGLE",
    min_select: normalizeInteger(input.min_select ?? 1),
    max_select: normalizeInteger(input.max_select ?? 1),
    sort_order: normalizeInteger(input.sort_order ?? nextSortOrder()),
    is_required: input.is_required ?? true,
    items
  };
}

function cloneForTarget(group: ProductVariantGroup, target: { product_id?: string; category?: string }) {
  const id = "vgrp_" + randomUUID();
  return {
    ...group,
    id,
    product_id: target.product_id ?? group.product_id,
    category: target.category ?? group.category,
    name: group.name + " Kopie",
    items: group.items.map((item) => ({ ...item, id: "vitem_" + randomUUID(), variant_group_id: id }))
  };
}

function normalizeName(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}
function normalizeInteger(value: number) { return Math.max(0, Math.round(Number(value) || 0)); }
function normalizeCents(value: number) { return Math.round(Number(value) || 0); }
function nextSortOrder() { return (Math.max(0, ...variantGroups.map((group) => group.sort_order)) + 10); }
function sortGroups(a: ProductVariantGroup, b: ProductVariantGroup) { return a.sort_order - b.sort_order || a.name.localeCompare(b.name); }
function cloneGroup(group: ProductVariantGroup) { return { ...group, items: group.items.map((item) => ({ ...item })).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)) }; }
