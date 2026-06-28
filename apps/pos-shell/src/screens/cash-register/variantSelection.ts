import type {
  BasketLineVariant,
  ProductVariantGroup,
  ProductVariantGroupItem,
} from "../../lib/pos-types";

export function getDefaultSelections(groups: ProductVariantGroup[]) {
  return groups.reduce<Record<string, ProductVariantGroupItem>>(
    (selections, group) => {
      const defaultItem = group.items.find((item) => item.is_default);

      if (defaultItem) {
        selections[group.id] = defaultItem;
      }

      return selections;
    },
    {},
  );
}

export function buildSelectedBasketVariants(
  groups: ProductVariantGroup[],
  selectedItemsByGroupId: Record<string, ProductVariantGroupItem>,
) {
  return groups.flatMap<BasketLineVariant>((group) => {
    const item = selectedItemsByGroupId[group.id];

    if (!item) {
      return [];
    }

    return [
      {
        variant_group_id: group.id,
        variant_group_name: group.name,
        variant_item_id: item.id,
        variant_item_name: item.name,
        price_delta: item.price_delta,
      },
    ];
  });
}
