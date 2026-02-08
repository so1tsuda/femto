mod commands;
mod editor;

use std::sync::Mutex;

use editor::state::EditorState;

fn main() {
    tauri::Builder::default()
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
