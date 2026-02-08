use crate::editor::state::EditorState;

impl EditorState {
    pub fn insert_text(&mut self, text: &str) {
        if text.is_empty() {
            return;
        }

        self.record_undo_snapshot();
        self.buffer.insert_str(self.cursor, text);
        self.cursor += text.chars().count();
        self.modified = true;
        self.status_message = None;
    }

    pub fn delete_char(&mut self) {
        if self.cursor >= self.buffer.char_len() {
            return;
        }

        self.record_undo_snapshot();
        self.buffer.remove_range(self.cursor, self.cursor + 1);
        self.modified = true;
        self.status_message = None;
    }

    pub fn delete_backward_char(&mut self) {
        if self.cursor == 0 {
            return;
        }

        self.record_undo_snapshot();
        self.buffer.remove_range(self.cursor - 1, self.cursor);
        self.cursor -= 1;
        self.modified = true;
        self.status_message = None;
    }

    pub fn kill_line(&mut self) {
        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        if self.cursor >= chars.len() {
            return;
        }

        let mut end = self.cursor;
        while end < chars.len() && chars[end] != '\n' {
            end += 1;
        }
        if end < chars.len() && chars[end] == '\n' {
            end += 1;
        }

        if end <= self.cursor {
            return;
        }

        let killed: String = chars[self.cursor..end].iter().collect();
        self.record_undo_snapshot();
        self.buffer.remove_range(self.cursor, end);
        self.push_kill_ring(killed);
        self.modified = true;
        self.status_message = Some("Killed line".to_string());
    }

    pub fn copy_region(&mut self, start: usize, end: usize) {
        if start >= end {
            return;
        }

        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        let safe_end = end.min(chars.len());
        if start >= safe_end {
            return;
        }

        let copied: String = chars[start..safe_end].iter().collect();
        self.push_kill_ring(copied);
        self.status_message = Some("Copied region".to_string());
    }

    pub fn kill_region(&mut self, start: usize, end: usize) {
        if start >= end {
            return;
        }

        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        let safe_end = end.min(chars.len());
        if start >= safe_end {
            return;
        }

        let killed: String = chars[start..safe_end].iter().collect();
        self.record_undo_snapshot();
        self.buffer.remove_range(start, safe_end);
        self.cursor = start.min(self.buffer.char_len());
        self.push_kill_ring(killed);
        self.modified = true;
        self.status_message = Some("Killed region".to_string());
    }

    pub fn yank(&mut self) {
        let Some(text) = self.kill_ring.first().cloned() else {
            self.status_message = Some("Kill ring empty".to_string());
            return;
        };

        self.record_undo_snapshot();
        self.buffer.insert_str(self.cursor, &text);
        self.cursor += text.chars().count();
        self.modified = true;
        self.status_message = Some("Yank".to_string());
    }

    pub fn set_cursor(&mut self, cursor: usize) {
        self.cursor = cursor.min(self.buffer.char_len());
    }
}
