use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalConfig {
    local_master_url: String,
    local_master_instance_id: String,
    terminal_id: String,
    terminal_name: String,
    terminal_role: String,
    terminal_secret: String,
    paired_at: i64,
    last_seen_at: i64,
}

#[tauri::command]
fn load_terminal_config(app: AppHandle) -> Result<Option<TerminalConfig>, String> {
    let path = terminal_config_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let config = serde_json::from_str(&text).map_err(|error| error.to_string())?;

    Ok(Some(config))
}

#[tauri::command]
fn save_terminal_config(app: AppHandle, config: TerminalConfig) -> Result<(), String> {
    let path = terminal_config_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let text = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_terminal_config(app: AppHandle) -> Result<(), String> {
    let path = terminal_config_path(&app)?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn terminal_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;

    Ok(dir.join("terminal-config.json"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_terminal_config,
            save_terminal_config,
            clear_terminal_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}