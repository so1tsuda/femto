#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod editor;

use std::sync::Mutex;

use editor::state::EditorState;
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let mut paths: Vec<String> = Vec::new();
            for arg in std::env::args().skip(1) {
                if arg.starts_with('-') {
                    continue;
                }
                let path = std::path::PathBuf::from(arg);
                let resolved = if path.is_absolute() {
                    path
                } else {
                    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")).join(path)
                };
                paths.push(resolved.to_string_lossy().to_string());
            }
            if let Some(first) = paths.first() {
                let _ = app.emit("open-file", first.clone());
            }
            Ok(())
        })
        .manage(Mutex::new(EditorState::new()))
        .invoke_handler(tauri::generate_handler![
            commands::initialize_editor,
            commands::editor_command,
            commands::start_query_replace,
            commands::query_replace_step,
            commands::open_file,
            commands::file_exists,
            commands::default_save_directory,
            commands::path_completions,
            commands::load_app_config,
            commands::save_file,
            commands::save_file_as
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
