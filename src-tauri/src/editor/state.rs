use serde::Serialize;
use std::path::PathBuf;

use crate::editor::buffer::TextBuffer;
use crate::editor::search::QueryReplaceSession;
use crate::editor::undo::{UndoSnapshot, UndoStack};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSnapshot {
    pub text: String,
    pub cursor: usize,
    pub line: usize,
    pub col: usize,
    pub chars: usize,
    pub modified: bool,
    pub encoding: String,
    pub line_ending: String,
    pub file_path: Option<String>,
    pub status_message: Option<String>,
}

#[derive(Debug)]
pub struct EditorState {
    pub buffer: TextBuffer,
    pub cursor: usize,
    pub undo_stack: UndoStack,
    pub modified: bool,
    pub original_encoding: String,
    pub line_ending: String,
    pub file_path: Option<PathBuf>,
    pub status_message: Option<String>,
    pub query_replace_session: Option<QueryReplaceSession>,
    pub kill_ring: Vec<String>,
}

impl EditorState {
    pub fn new() -> Self {
        Self {
            buffer: TextBuffer::new(),
            cursor: 0,
            undo_stack: UndoStack::new(),
            modified: false,
            original_encoding: "UTF-8".to_string(),
            line_ending: "CRLF".to_string(),
            file_path: None,
            status_message: None,
            query_replace_session: None,
            kill_ring: Vec::new(),
        }
    }

    pub fn snapshot(&self) -> EditorSnapshot {
        let (line, col) = self.line_col();
        let _ = &self.undo_stack;

        EditorSnapshot {
            text: self.buffer.as_str().to_string(),
            cursor: self.cursor,
            line,
            col,
            chars: self.buffer.char_len(),
            modified: self.modified,
            encoding: self.original_encoding.clone(),
            line_ending: self.line_ending.clone(),
            file_path: self
                .file_path
                .as_ref()
                .map(|path| path.to_string_lossy().to_string()),
            status_message: self.status_message.clone(),
        }
    }

    pub fn load_content(
        &mut self,
        content: String,
        encoding: String,
        line_ending: String,
        file_path: PathBuf,
    ) {
        self.buffer = TextBuffer::from_text(content);
        self.cursor = 0;
        self.modified = false;
        self.original_encoding = encoding;
        self.line_ending = line_ending;
        self.file_path = Some(file_path);
        self.undo_stack.clear_all();
        self.query_replace_session = None;
    }

    pub fn set_file_path(&mut self, file_path: PathBuf) {
        self.file_path = Some(file_path);
    }

    pub fn set_status_message(&mut self, message: Option<String>) {
        self.status_message = message;
    }

    pub fn mark_saved(&mut self) {
        self.modified = false;
    }

    pub fn record_undo_snapshot(&mut self) {
        self.undo_stack.push_undo(UndoSnapshot {
            text: self.buffer.as_str().to_string(),
            cursor: self.cursor,
        });
        self.undo_stack.clear_redo();
    }

    pub fn undo(&mut self) {
        let Some(prev) = self.undo_stack.pop_undo() else {
            self.set_status_message(Some("Undo: no more changes".to_string()));
            return;
        };

        let current = UndoSnapshot {
            text: self.buffer.as_str().to_string(),
            cursor: self.cursor,
        };
        self.undo_stack.push_redo(current);
        self.buffer = TextBuffer::from_text(prev.text);
        self.cursor = prev.cursor.min(self.buffer.char_len());
        self.modified = true;
        self.set_status_message(Some("Undo".to_string()));
    }

    pub fn redo(&mut self) {
        let Some(next) = self.undo_stack.pop_redo() else {
            self.set_status_message(Some("Redo: no more changes".to_string()));
            return;
        };

        let current = UndoSnapshot {
            text: self.buffer.as_str().to_string(),
            cursor: self.cursor,
        };
        self.undo_stack.push_undo(current);
        self.buffer = TextBuffer::from_text(next.text);
        self.cursor = next.cursor.min(self.buffer.char_len());
        self.modified = true;
        self.set_status_message(Some("Redo".to_string()));
    }

    pub fn push_kill_ring(&mut self, text: String) {
        if text.is_empty() {
            return;
        }
        self.kill_ring.insert(0, text);
        if self.kill_ring.len() > 10 {
            self.kill_ring.truncate(10);
        }
    }

    pub fn line_col(&self) -> (usize, usize) {
        self.line_col_at(self.cursor)
    }

    pub fn line_col_at(&self, cursor: usize) -> (usize, usize) {
        let mut line = 1;
        let mut col = 1;

        for (idx, ch) in self.buffer.as_str().chars().enumerate() {
            if idx == cursor {
                break;
            }
            if ch == '\n' {
                line += 1;
                col = 1;
            } else {
                col += 1;
            }
        }

        (line, col)
    }

    pub fn line_col_to_cursor(&self, target_line: usize, target_col: usize) -> Option<usize> {
        if target_line == 0 || target_col == 0 {
            return None;
        }

        let mut line = 1;
        let mut col = 1;
        let mut cursor = 0;
        let chars: Vec<char> = self.buffer.as_str().chars().collect();

        while cursor < chars.len() {
            if line == target_line {
                break;
            }
            if chars[cursor] == '\n' {
                line += 1;
                col = 1;
            } else {
                col += 1;
            }
            cursor += 1;
        }

        if line != target_line {
            return None;
        }

        while cursor < chars.len() && chars[cursor] != '\n' && col < target_col {
            cursor += 1;
            col += 1;
        }

        Some(cursor)
    }
}
