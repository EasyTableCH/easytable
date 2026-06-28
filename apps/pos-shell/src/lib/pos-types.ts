export type PosProduct = {
  id: string;
  product_type: "BASIC" | "SERVICE";
  name: string;
  category: string;
  price: number;
  tax_code_id: string;
  tax_code_name: string;
  tax_rate_bps: number;
  is_available: boolean;
  station: string;
};

export type ProductVariantGroupItem = {
  id: string;
  variant_group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
};

export type ProductVariantGroup = {
  id: string;
  applies_to: "PRODUCT" | "CATEGORY";
  product_id: string | null;
  category: string | null;
  name: string;
  selection_type: "SINGLE" | "MULTIPLE";
  min_select: number;
  max_select: number;
  sort_order: number;
  is_required: boolean;
  items: ProductVariantGroupItem[];
};

export type ProductCard = PosProduct & {
  tone: string;
  accent: string;
};

export type BasketLineVariant = {
  variant_group_id: string;
  variant_group_name: string;
  variant_item_id: string;
  variant_item_name: string;
  price_delta: number;
};

export type BasketLine = {
  id: string;
  product_id: string;
  product_type: PosProduct["product_type"];
  product_name: string;
  product_category: string;
  base_price: number;
  tax_code_id: string;
  tax_code_name: string;
  tax_rate_bps: number;
  station: string;
  variants: BasketLineVariant[];
  unit_total: number;
  quantity: number;
  line_total: number;
};
