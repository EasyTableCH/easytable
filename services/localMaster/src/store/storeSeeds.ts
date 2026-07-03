import type {
  ProductVariantGroup,
  ProductVariantGroupItem,
  TableLayoutArea,
  TableLayoutFloor,
  TableLayoutTable
} from "../types.js";

// Mirrors apps/pos-shell/src-tauri/src/seeds.rs until migrations move into localMaster.
export const tenant = { id: "tenant_basilica", name: "Basilica" };
export const location = { id: "loc_basilica_main", tenant_id: tenant.id, name: "Basilica" };

export const floors: Array<Omit<TableLayoutFloor, "areas">> = [
  { id: "floor_basilica_eg", location_id: location.id, name: "EG", sort_order: 10 },
  { id: "floor_basilica_og", location_id: location.id, name: "OG", sort_order: 20 }
];

export const areas: Array<Omit<TableLayoutArea, "tables">> = [
  { id: "area_basilica_bar", floor_id: "floor_basilica_eg", name: "Bar", sort_order: 10 },
  { id: "area_basilica_fumoir", floor_id: "floor_basilica_eg", name: "Fumoir", sort_order: 20 },
  { id: "area_basilica_lounges", floor_id: "floor_basilica_eg", name: "Lounges", sort_order: 30 },
  { id: "area_basilica_raucherlounge", floor_id: "floor_basilica_eg", name: "Raucherlounge", sort_order: 40 },
  { id: "area_basilica_og_lounge", floor_id: "floor_basilica_og", name: "Lounge", sort_order: 10 }
];

export const layoutTables: Array<
  Omit<TableLayoutTable, "open_order_id" | "open_order_number" | "open_total" | "open_order_count">
> = [
  { id: "table_basilica_fumoir_2", area_id: "area_basilica_fumoir", name: "2", seats: 4, sort_order: 10 },
  { id: "table_basilica_fumoir_3", area_id: "area_basilica_fumoir", name: "3", seats: 4, sort_order: 20 },
  { id: "table_basilica_bar_1", area_id: "area_basilica_bar", name: "1", seats: 2, sort_order: 10 },
  { id: "table_basilica_lounges_10", area_id: "area_basilica_lounges", name: "10", seats: 6, sort_order: 10 },
  { id: "table_basilica_raucherlounge_20", area_id: "area_basilica_raucherlounge", name: "20", seats: 8, sort_order: 10 },
  { id: "table_basilica_og_30", area_id: "area_basilica_og_lounge", name: "30", seats: 4, sort_order: 10 }
];

export const variantGroups: ProductVariantGroup[] = [
  {
    id: "vgrp_shisha_standard_head",
    applies_to: "CATEGORY",
    product_id: null,
    category: "Shisha",
    name: "Head",
    selection_type: "SINGLE",
    min_select: 1,
    max_select: 1,
    sort_order: 10,
    is_required: true,
    items: [
      createVariantItem("vitem_shisha_standard_head_standard", "vgrp_shisha_standard_head", "Standard", 0, true, 10),
      createVariantItem("vitem_shisha_standard_head_silver", "vgrp_shisha_standard_head", "Silver", 500, false, 20),
      createVariantItem("vitem_shisha_standard_head_premium", "vgrp_shisha_standard_head", "Premium", 1000, false, 30)
    ]
  }
];

function createVariantItem(
  id: string,
  variantGroupId: string,
  name: string,
  priceDelta: number,
  isDefault: boolean,
  sortOrder: number
): ProductVariantGroupItem {
  return {
    id,
    variant_group_id: variantGroupId,
    name,
    price_delta: priceDelta,
    is_default: isDefault,
    sort_order: sortOrder
  };
}
