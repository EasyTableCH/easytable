mod db;
mod orders;
mod products;
mod seeds;
mod tables;
mod util;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            db::initialize_pos_database,
            orders::create_order_snapshot,
            orders::get_open_table_order_basket,
            tables::list_table_layout,
            products::list_products,
            products::list_product_variant_groups
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
