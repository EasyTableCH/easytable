mod db;
mod orders;
mod products;
mod seeds;
mod tables;
mod util;

use db::{setup_database, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Open + migrate + seed the database ONCE at startup.
            // The resulting connection is wrapped in a Mutex and stored as
            // shared application state so that every Tauri command serialises
            // access through this single connection – no more concurrent writes.
            let conn = setup_database(&app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::initialize_pos_database,
            orders::complete_mock_payment,
            orders::create_order_snapshot,
            orders::get_open_table_order_basket,
            tables::list_table_layout,
            products::list_products,
            products::list_product_variant_groups
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
