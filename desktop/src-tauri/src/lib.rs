// Learn more about Tauri commands at:
// https://tauri.app/develop/calling-rust/

use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_catalog",
            sql: include_str!("../migrations/001_initial_catalog.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "product_unit_eligibility",
            sql: include_str!("../migrations/002_product_unit_eligibility.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:pharmacy.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
