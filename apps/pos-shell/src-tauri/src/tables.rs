use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

use crate::db::DbState;

#[derive(Serialize)]
pub(crate) struct TableLayout {
    tenant: TableLayoutTenant,
    location: TableLayoutLocation,
    floors: Vec<TableLayoutFloor>,
}

#[derive(Serialize)]
struct TableLayoutTenant {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct TableLayoutLocation {
    id: String,
    tenant_id: String,
    name: String,
}

#[derive(Serialize)]
struct TableLayoutFloor {
    id: String,
    location_id: String,
    name: String,
    sort_order: i64,
    areas: Vec<TableLayoutArea>,
}

#[derive(Serialize)]
struct TableLayoutArea {
    id: String,
    floor_id: String,
    name: String,
    sort_order: i64,
    tables: Vec<TableLayoutTable>,
}

#[derive(Serialize)]
struct TableLayoutTable {
    id: String,
    area_id: String,
    name: String,
    seats: i64,
    sort_order: i64,
    open_order_id: Option<String>,
    open_order_number: Option<String>,
    open_total: i64,
    open_order_count: i64,
}

#[tauri::command]
pub(crate) fn list_table_layout(state: State<DbState>) -> Result<TableLayout, String> {
    let connection = state.0.lock().map_err(|_| "Database lock poisoned".to_string())?;

    let tenant = connection
        .query_row(
            "
            SELECT id, name
            FROM tenants
            ORDER BY name
            LIMIT 1
            ",
            [],
            |row| {
                Ok(TableLayoutTenant {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            },
        )
        .map_err(|error| format!("Could not read table layout tenant: {error}"))?;

    let location = connection
        .query_row(
            "
            SELECT id, tenant_id, name
            FROM locations
            WHERE tenant_id = ?1
            ORDER BY name
            LIMIT 1
            ",
            params![tenant.id],
            |row| {
                Ok(TableLayoutLocation {
                    id: row.get(0)?,
                    tenant_id: row.get(1)?,
                    name: row.get(2)?,
                })
            },
        )
        .map_err(|error| format!("Could not read table layout location: {error}"))?;

    let mut floor_statement = connection
        .prepare(
            "
            SELECT id, location_id, name, sort_order
            FROM floors
            WHERE location_id = ?1
            ORDER BY sort_order, name
            ",
        )
        .map_err(|error| format!("Could not prepare floor query: {error}"))?;

    let floor_rows = floor_statement
        .query_map(params![location.id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|error| format!("Could not query floors: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read floor row: {error}"))?;

    let mut floors = Vec::with_capacity(floor_rows.len());

    for (floor_id, location_id, floor_name, floor_sort_order) in floor_rows {
        let areas = list_table_layout_areas(&connection, &floor_id)?;

        floors.push(TableLayoutFloor {
            id: floor_id,
            location_id,
            name: floor_name,
            sort_order: floor_sort_order,
            areas,
        });
    }

    Ok(TableLayout {
        tenant,
        location,
        floors,
    })
}

fn list_table_layout_areas(
    connection: &Connection,
    floor_id: &str,
) -> Result<Vec<TableLayoutArea>, String> {
    let mut area_statement = connection
        .prepare(
            "
            SELECT id, floor_id, name, sort_order
            FROM areas
            WHERE floor_id = ?1
            ORDER BY sort_order, name
            ",
        )
        .map_err(|error| format!("Could not prepare area query: {error}"))?;

    let area_rows = area_statement
        .query_map(params![floor_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|error| format!("Could not query areas: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read area row: {error}"))?;

    let mut areas = Vec::with_capacity(area_rows.len());

    for (area_id, area_floor_id, area_name, area_sort_order) in area_rows {
        let tables = list_table_layout_tables(connection, &area_id)?;

        areas.push(TableLayoutArea {
            id: area_id,
            floor_id: area_floor_id,
            name: area_name,
            sort_order: area_sort_order,
            tables,
        });
    }

    Ok(areas)
}

fn list_table_layout_tables(
    connection: &Connection,
    area_id: &str,
) -> Result<Vec<TableLayoutTable>, String> {
    let mut table_statement = connection
        .prepare(
            "
            SELECT
              tables.id,
              tables.area_id,
              tables.name,
              tables.seats,
              tables.sort_order,
              open_orders.id,
              open_orders.order_number,
              COALESCE(open_orders.total, 0),
              CASE WHEN open_orders.id IS NULL THEN 0 ELSE 1 END
            FROM tables
            LEFT JOIN orders AS open_orders ON open_orders.table_id = tables.id
              AND open_orders.service_mode = 'TABLE'
              AND open_orders.status = 'OPEN'
              AND open_orders.payment_status = 'UNPAID'
            WHERE tables.area_id = ?1
              AND tables.is_active = 1
            ORDER BY tables.sort_order, tables.name
            ",
        )
        .map_err(|error| format!("Could not prepare table query: {error}"))?;

    let tables = table_statement
        .query_map(params![area_id], |row| {
            Ok(TableLayoutTable {
                id: row.get(0)?,
                area_id: row.get(1)?,
                name: row.get(2)?,
                seats: row.get(3)?,
                sort_order: row.get(4)?,
                open_order_id: row.get(5)?,
                open_order_number: row.get(6)?,
                open_total: row.get(7)?,
                open_order_count: row.get(8)?,
            })
        })
        .map_err(|error| format!("Could not query tables: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read table row: {error}"))?;

    Ok(tables)
}
