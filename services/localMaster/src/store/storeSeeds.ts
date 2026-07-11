import type {
  ProductVariantGroup,
} from "../types.js";

// Mirrors apps/pos-shell/src-tauri/src/seeds.rs until migrations move into localMaster.
export const tenant = { id: "tenant_basilica", name: "Basilica" };
export const location = { id: "loc_basilica_main", tenant_id: tenant.id, name: "Basilica" };

export const variantGroups: ProductVariantGroup[] = [];
