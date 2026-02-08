use std::path::{Path, PathBuf};
use std::sync::Mutex;

use encoding_rs::{EUC_JP, SHIFT_JIS};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::fs;

use crate::editor::search::QueryReplaceStatus;
use crate::editor::state::{EditorSnapshot, EditorState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertPayload {
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionPayload {
    start: usize,
    end: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPayload {
    query: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPayload {
    cursor: usize,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum CommandPayload {
    Insert(InsertPayload),
    Region(RegionPayload),
    Search(SearchPayload),
    Cursor(CursorPayload),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryReplacePayload {
    query: String,
    replace_with: String,
}

#[derive(Debug, Deserialize)]
pub struct QueryReplaceStepPayload {
    action: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryReplaceResponse {
    pub snapshot: EditorSnapshot,
    pub status: QueryReplaceStatus,
}

#[derive(Debug, Deserialize, Default)]
struct RawConfig {
    theme: Option<RawThemeConfig>,
}

#[derive(Debug, Deserialize, Default)]
struct RawThemeConfig {
    background_color: Option<String>,
    text_color: Option<String>,
    cursor_color: Option<String>,
    selection_bg: Option<String>,
    statusbar_bg: Option<String>,
    minibuffer_bg: Option<String>,
    background_image: Option<String>,
    font_family: Option<String>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background_color: Option<String>,
    pub text_color: Option<String>,
    pub cursor_color: Option<String>,
    pub selection_bg: Option<String>,
    pub statusbar_bg: Option<String>,
    pub minibuffer_bg: Option<String>,
    pub background_image: Option<String>,
    pub font_family: Option<String>,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigResponse {
    pub theme: ThemeConfig,
    pub source_path: Option<String>,
}

#[derive(Debug)]
struct DecodedContent {
    text: String,
    encoding: String,
    line_ending: String,
}

#[tauri::command]
pub fn initialize_editor(state: State<'_, Mutex<EditorState>>) -> EditorSnapshot {
    let editor = state.lock().expect("state lock poisoned");
    editor.snapshot()
}

#[tauri::command]
pub fn editor_command(
    command: String,
    payload: Option<CommandPayload>,
    state: State<'_, Mutex<EditorState>>,
) -> Result<EditorSnapshot, String> {
    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;

    match command.as_str() {
        "noop" => {}
        "keyboard_quit" => {
            editor.query_replace_session = None;
            editor.set_status_message(Some("Quit".to_string()));
        }
        "move_to_line_start" => editor.move_to_line_start(),
        "move_to_line_end" => editor.move_to_line_end(),
        "move_forward" => editor.move_forward(),
        "move_backward" => editor.move_backward(),
        "move_next_line" => editor.move_next_line(),
        "move_previous_line" => editor.move_previous_line(),
        "move_forward_word" => editor.move_forward_word(),
        "move_backward_word" => editor.move_backward_word(),
        "move_to_buffer_start" => editor.move_to_buffer_start(),
        "move_to_buffer_end" => editor.move_to_buffer_end(),
        "delete_char" => editor.delete_char(),
        "delete_backward_char" => editor.delete_backward_char(),
        "kill_line" => editor.kill_line(),
        "yank" => editor.yank(),
        "undo" => editor.undo(),
        "redo" => editor.redo(),
        "kill_region" => match payload {
            Some(CommandPayload::Region(region)) => editor.kill_region(region.start, region.end),
            _ => return Err("kill_region requires region payload".to_string()),
        },
        "copy_region" => match payload {
            Some(CommandPayload::Region(region)) => editor.copy_region(region.start, region.end),
            _ => return Err("copy_region requires region payload".to_string()),
        },
        "isearch_forward" => match payload {
            Some(CommandPayload::Search(search)) => editor.isearch_forward(&search.query)?,
            _ => return Err("isearch_forward requires search payload".to_string()),
        },
        "isearch_backward" => match payload {
            Some(CommandPayload::Search(search)) => editor.isearch_backward(&search.query)?,
            _ => return Err("isearch_backward requires search payload".to_string()),
        },
        "set_cursor" => match payload {
            Some(CommandPayload::Cursor(cursor)) => editor.set_cursor(cursor.cursor),
            _ => return Err("set_cursor requires cursor payload".to_string()),
        },
        "insert_text" => match payload {
            Some(CommandPayload::Insert(insert)) => editor.insert_text(&insert.text),
            _ => return Err("insert_text requires payload".to_string()),
        },
        _ => return Err(format!("unknown command: {command}")),
    }

    Ok(editor.snapshot())
}

#[tauri::command]
pub fn start_query_replace(
    payload: QueryReplacePayload,
    state: State<'_, Mutex<EditorState>>,
) -> Result<QueryReplaceResponse, String> {
    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    let status = editor.start_query_replace(payload.query, payload.replace_with)?;
    let snapshot = editor.snapshot();
    Ok(QueryReplaceResponse { snapshot, status })
}

#[tauri::command]
pub fn query_replace_step(
    payload: QueryReplaceStepPayload,
    state: State<'_, Mutex<EditorState>>,
) -> Result<QueryReplaceResponse, String> {
    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    let status = editor.query_replace_step(&payload.action)?;
    let snapshot = editor.snapshot();
    Ok(QueryReplaceResponse { snapshot, status })
}

#[tauri::command]
pub async fn open_file(
    path: String,
    state: State<'_, Mutex<EditorState>>,
) -> Result<EditorSnapshot, String> {
    let path_buf = PathBuf::from(path);
    enum OpenResult {
        Existing(DecodedContent),
        NewFile,
    }

    let open_result = match fs::read(&path_buf).await {
        Ok(bytes) => OpenResult::Existing(decode_content(&bytes)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => OpenResult::NewFile,
        Err(err) => return Err(format!("failed to read file: {err}")),
    };

    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    match open_result {
        OpenResult::Existing(decoded) => {
            editor.load_content(
                decoded.text,
                decoded.encoding,
                decoded.line_ending,
                path_buf.clone(),
            );
            editor.set_status_message(Some(format!("Opened {}", path_buf.display())));
        }
        OpenResult::NewFile => {
            editor.load_content(
                String::new(),
                "UTF-8".to_string(),
                "CRLF".to_string(),
                path_buf.clone(),
            );
            editor.set_status_message(Some(format!("New file: {}", path_buf.display())));
        }
    }

    Ok(editor.snapshot())
}

#[tauri::command]
pub async fn save_file(state: State<'_, Mutex<EditorState>>) -> Result<EditorSnapshot, String> {
    let (path, text, line_ending) = {
        let editor = state
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        let path = editor
            .file_path
            .clone()
            .ok_or_else(|| "No file path. Use save as.".to_string())?;
        (
            path,
            editor.buffer.as_str().to_string(),
            editor.line_ending.clone(),
        )
    };

    write_content(&path, &text, &line_ending).await?;

    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    editor.mark_saved();
    editor.set_status_message(Some(format!("Saved {}", path.display())));
    Ok(editor.snapshot())
}

#[tauri::command]
pub async fn save_file_as(
    path: String,
    overwrite: bool,
    state: State<'_, Mutex<EditorState>>,
) -> Result<EditorSnapshot, String> {
    let target_path = PathBuf::from(path);
    if path_exists(&target_path).await && !overwrite {
        return Err("File exists. Confirmation required.".to_string());
    }

    let (text, line_ending) = {
        let editor = state
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        (
            editor.buffer.as_str().to_string(),
            editor.line_ending.clone(),
        )
    };

    write_content(&target_path, &text, &line_ending).await?;

    let mut editor = state
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    editor.set_file_path(target_path.clone());
    editor.mark_saved();
    editor.set_status_message(Some(format!("Saved {}", target_path.display())));
    Ok(editor.snapshot())
}

#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    let target = PathBuf::from(path);
    Ok(path_exists(&target).await)
}

#[tauri::command]
pub fn default_save_directory() -> Result<String, String> {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        if !user_profile.trim().is_empty() {
            return Ok(user_profile);
        }
    }

    if let Ok(home_drive) = std::env::var("HOMEDRIVE") {
        let home_path = std::env::var("HOMEPATH").unwrap_or_default();
        let combined = format!("{home_drive}{home_path}");
        if !combined.trim().is_empty() {
            return Ok(combined);
        }
    }

    let current = std::env::current_dir()
        .map_err(|err| format!("failed to resolve current dir: {err}"))?;
    Ok(current.to_string_lossy().to_string())
}

#[tauri::command]
pub fn path_completions(input: String) -> Result<Vec<String>, String> {
    let normalized = input.replace('/', "\\");
    let (base_dir, partial) = split_path_prefix(&normalized);
    let target_dir = if base_dir.is_empty() {
        std::env::current_dir().map_err(|err| format!("failed to resolve current dir: {err}"))?
    } else {
        PathBuf::from(base_dir)
    };

    let entries = std::fs::read_dir(&target_dir)
        .map_err(|err| format!("failed to read directory {}: {err}", target_dir.display()))?;

    let partial_lower = partial.to_lowercase();
    let mut matches: Vec<String> = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if !partial_lower.is_empty() && !file_name.to_lowercase().starts_with(&partial_lower) {
            continue;
        }

        let mut full = target_dir.join(&file_name).to_string_lossy().to_string();
        if entry.path().is_dir() && !full.ends_with('\\') {
            full.push('\\');
        }
        matches.push(full);
    }

    matches.sort();
    if matches.len() > 100 {
        matches.truncate(100);
    }
    Ok(matches)
}

#[tauri::command]
pub fn load_app_config() -> Result<AppConfigResponse, String> {
    let Some(path) = resolve_config_path() else {
        return Ok(AppConfigResponse::default());
    };

    if !path.exists() {
        return Ok(AppConfigResponse::default());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|err| format!("failed to read config {}: {err}", path.display()))?;
    let parsed: RawConfig = serde_yaml::from_str(&content)
        .map_err(|err| format!("failed to parse yaml config {}: {err}", path.display()))?;

    let theme = parsed.theme.unwrap_or_default();
    Ok(AppConfigResponse {
        theme: ThemeConfig {
            background_color: theme.background_color,
            text_color: theme.text_color,
            cursor_color: theme.cursor_color,
            selection_bg: theme.selection_bg,
            statusbar_bg: theme.statusbar_bg,
            minibuffer_bg: theme.minibuffer_bg,
            background_image: theme.background_image,
            font_family: theme.font_family,
        },
        source_path: Some(path.to_string_lossy().to_string()),
    })
}

async fn write_content(path: &Path, text: &str, line_ending: &str) -> Result<(), String> {
    create_backup_if_exists(path).await?;
    let content = normalize_line_endings(text, line_ending);
    fs::write(path, content)
        .await
        .map_err(|err| format!("failed to write file: {err}"))
}

async fn create_backup_if_exists(path: &Path) -> Result<(), String> {
    if !path_exists(path).await {
        return Ok(());
    }

    let backup = PathBuf::from(format!("{}~", path.to_string_lossy()));
    fs::copy(path, &backup)
        .await
        .map_err(|err| format!("failed to create backup {}: {err}", backup.display()))?;
    Ok(())
}

async fn path_exists(path: &Path) -> bool {
    fs::metadata(path).await.is_ok()
}

fn decode_content(bytes: &[u8]) -> DecodedContent {
    let line_ending = detect_line_ending(bytes);

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let text = normalize_loaded_text(&String::from_utf8_lossy(&bytes[3..]));
        return DecodedContent {
            text,
            encoding: "UTF-8 BOM".to_string(),
            line_ending,
        };
    }

    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
        return DecodedContent {
            text: normalize_loaded_text(&text),
            encoding: "UTF-8".to_string(),
            line_ending,
        };
    }

    let sjis = decode_with_score(bytes, SHIFT_JIS, "Shift-JIS");
    let eucjp = decode_with_score(bytes, EUC_JP, "EUC-JP");

    if sjis.score <= eucjp.score {
        DecodedContent {
            text: normalize_loaded_text(&sjis.text),
            encoding: sjis.encoding,
            line_ending,
        }
    } else {
        DecodedContent {
            text: normalize_loaded_text(&eucjp.text),
            encoding: eucjp.encoding,
            line_ending,
        }
    }
}

struct ScoredDecode {
    text: String,
    encoding: String,
    score: usize,
}

fn decode_with_score(
    bytes: &[u8],
    encoding: &'static encoding_rs::Encoding,
    label: &str,
) -> ScoredDecode {
    let (text, _used, had_errors) = encoding.decode(bytes);
    let owned = text.into_owned();

    let control_penalty = owned
        .chars()
        .filter(|ch| ch.is_control() && *ch != '\n' && *ch != '\r' && *ch != '\t')
        .count();

    let replacement_penalty = owned.chars().filter(|ch| *ch == '\u{FFFD}').count() * 4;
    let error_penalty = usize::from(had_errors) * 10;

    ScoredDecode {
        text: owned,
        encoding: label.to_string(),
        score: control_penalty + replacement_penalty + error_penalty,
    }
}

fn detect_line_ending(bytes: &[u8]) -> String {
    let has_crlf = bytes.windows(2).any(|window| window == b"\r\n");
    if has_crlf {
        return "CRLF".to_string();
    }
    if bytes.contains(&b'\n') {
        return "LF".to_string();
    }
    if bytes.contains(&b'\r') {
        return "CR".to_string();
    }
    "CRLF".to_string()
}

fn normalize_line_endings(text: &str, line_ending: &str) -> String {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    match line_ending {
        "LF" => normalized,
        "CR" => normalized.replace('\n', "\r"),
        _ => normalized.replace('\n', "\r\n"),
    }
}

fn normalize_loaded_text(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn split_path_prefix(input: &str) -> (&str, &str) {
    if input.is_empty() {
        return ("", "");
    }

    if input.ends_with('\\') {
        return (input, "");
    }

    if let Some(index) = input.rfind('\\') {
        return (&input[..=index], &input[index + 1..]);
    }

    ("", input)
}

fn resolve_config_path() -> Option<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        if !appdata.trim().is_empty() {
            return Some(PathBuf::from(appdata).join("Femto").join("config.yaml"));
        }
    }
    None
}
