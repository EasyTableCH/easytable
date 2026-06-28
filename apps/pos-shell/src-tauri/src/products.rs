use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::db::{migrate_database, open_database};
use crate::seeds::{
    seed_products, seed_table_layout, seed_tax_codes, seed_variant_group_items, seed_variant_groups,
};

#[derive(Serialize)]
pub(crate) struct PosProduct {
    id: String,
    product_type: String,
    name: String,
    category: String,
    price: i64,
    tax_code_id: String,
    tax_code_name: String,
    tax_rate_bps: i64,
    is_available: bool,
    station: String,
}

#[derive(Serialize)]
pub(crate) struct PosProductVariantGroup {
    id: String,
    applies_to: String,
    product_id: Option<String>,
    category: Option<String>,
    name: String,
    selection_type: String,
    min_select: i64,
    max_select: i64,
    sort_order: i64,
    is_required: bool,
    items: Vec<PosProductVariantGroupItem>,
}

#[derive(Serialize)]
pub(crate) struct PosProductVariantGroupItem {
    id: String,
    variant_group_id: String,
    name: String,
    price_delta: i64,
    is_default: bool,
    sort_order: i64,
}

#[tauri::command]
pub(crate) fn list_products(app: AppHandle) -> Result<Vec<PosProduct>, String> {
    let connection = open_database(&app)?;
    migrate_database(&connection)?;
    seed_table_layout(&connection)?;
    seed_tax_codes(&connection)?;
    seed_products(&connection)?;
    seed_variant_groups(&connection)?;
    seed_variant_group_items(&connection)?;

    let mut statement = connection
        .prepare(
            "
            SELECT
              products.id,
              products.product_type,
              products.name,
              products.category,
              products.price,
              tax_codes.id,
              tax_codes.name,
              tax_codes.rate_bps,
              products.is_available,
              products.station
            FROM products
            INNER JOIN tax_codes ON tax_codes.id = products.tax_code_id
            WHERE products.is_available = 1
              AND tax_codes.is_active = 1
            ORDER BY products.category, products.name
            ",
        )
        .map_err(|error| format!("Could not prepare product query: {error}"))?;

    let products = statement
        .query_map([], |row| {
            Ok(PosProduct {
                id: row.get(0)?,
                product_type: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                price: row.get(4)?,
                tax_code_id: row.get(5)?,
                tax_code_name: row.get(6)?,
                tax_rate_bps: row.get(7)?,
                is_available: row.get::<_, i64>(8)? == 1,
                station: row.get(9)?,
            })
        })
        .map_err(|error| format!("Could not query products: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read product row: {error}"))?;

    Ok(products)
}

#[tauri::command]
pub(crate) fn list_product_variant_groups(
    app: AppHandle,
    product_id: String,
) -> Result<Vec<PosProductVariantGroup>, String> {
    let connection = open_database(&app)?;
    migrate_database(&connection)?;
    seed_table_layout(&connection)?;
    seed_tax_codes(&connection)?;
    seed_products(&connection)?;
    seed_variant_groups(&connection)?;
    seed_variant_group_items(&connection)?;

    let mut group_statement = connection
        .prepare(
            "
            SELECT
              product_variant_groups.id,
              product_variant_groups.applies_to,
              product_variant_groups.product_id,
              product_variant_groups.category,
              product_variant_groups.name,
              product_variant_groups.selection_type,
              product_variant_groups.min_select,
              product_variant_groups.max_select,
              product_variant_groups.sort_order,
              product_variant_groups.is_required
            FROM product_variant_groups
            INNER JOIN products ON products.id = ?1
            WHERE (
                (
                  product_variant_groups.applies_to = 'PRODUCT'
                  AND product_variant_groups.product_id = products.id
                )
                OR (
                  product_variant_groups.applies_to = 'CATEGORY'
                  AND product_variant_groups.category = products.category
                )
              )
              AND product_variant_groups.is_active = 1
              AND products.product_type = 'BASIC'
            ORDER BY product_variant_groups.sort_order, product_variant_groups.name
            ",
        )
        .map_err(|error| format!("Could not prepare variant group query: {error}"))?;

    let group_rows = group_statement
        .query_map(params![product_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)? == 1,
            ))
        })
        .map_err(|error| format!("Could not query variant groups: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read variant group row: {error}"))?;

    let mut groups = Vec::with_capacity(group_rows.len());

    for (
        id,
        applies_to,
        product_id,
        category,
        name,
        selection_type,
        min_select,
        max_select,
        sort_order,
        is_required,
    ) in group_rows
    {
        let items = list_variant_group_items(&connection, &id)?;

        groups.push(PosProductVariantGroup {
            id,
            applies_to,
            product_id,
            category,
            name,
            selection_type,
            min_select,
            max_select,
            sort_order,
            is_required,
            items,
        });
    }

    Ok(groups)
}

fn list_variant_group_items(
    connection: &Connection,
    variant_group_id: &str,
) -> Result<Vec<PosProductVariantGroupItem>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, variant_group_id, name, price_delta, is_default, sort_order
            FROM product_variant_group_items
            WHERE variant_group_id = ?1
              AND is_active = 1
            ORDER BY sort_order, name
            ",
        )
        .map_err(|error| format!("Could not prepare variant item query: {error}"))?;

    let items = statement
        .query_map(params![variant_group_id], |row| {
            Ok(PosProductVariantGroupItem {
                id: row.get(0)?,
                variant_group_id: row.get(1)?,
                name: row.get(2)?,
                price_delta: row.get(3)?,
                is_default: row.get::<_, i64>(4)? == 1,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|error| format!("Could not query variant items: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read variant item row: {error}"))?;

    Ok(items)
}
