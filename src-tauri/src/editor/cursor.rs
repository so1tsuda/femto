use crate::editor::state::EditorState;

fn is_word_char(ch: char) -> bool {
    ch.is_alphanumeric() || ch == '_'
}

impl EditorState {
    pub fn move_forward(&mut self) {
        if self.cursor < self.buffer.char_len() {
            self.cursor += 1;
        }
    }

    pub fn move_backward(&mut self) {
        if self.cursor > 0 {
            self.cursor -= 1;
        }
    }

    pub fn move_to_line_start(&mut self) {
        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        while self.cursor > 0 && chars[self.cursor - 1] != '\n' {
            self.cursor -= 1;
        }
    }

    pub fn move_to_line_end(&mut self) {
        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        while self.cursor < chars.len() && chars[self.cursor] != '\n' {
            self.cursor += 1;
        }
    }

    pub fn move_next_line(&mut self) {
        let (line, col) = self.line_col();
        let target_line = line + 1;
        if let Some(cursor) = self.line_col_to_cursor(target_line, col) {
            self.cursor = cursor;
        }
    }

    pub fn move_previous_line(&mut self) {
        let (line, col) = self.line_col();
        if line <= 1 {
            return;
        }
        let target_line = line - 1;
        if let Some(cursor) = self.line_col_to_cursor(target_line, col) {
            self.cursor = cursor;
        }
    }

    pub fn move_forward_word(&mut self) {
        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        while self.cursor < chars.len() && is_word_char(chars[self.cursor]) {
            self.cursor += 1;
        }
        while self.cursor < chars.len() && !is_word_char(chars[self.cursor]) {
            self.cursor += 1;
        }
    }

    pub fn move_backward_word(&mut self) {
        let chars: Vec<char> = self.buffer.as_str().chars().collect();
        if self.cursor == 0 || chars.is_empty() {
            return;
        }

        let mut pos = self.cursor - 1;
        while pos > 0 && !is_word_char(chars[pos]) {
            pos -= 1;
        }
        while pos > 0 && is_word_char(chars[pos - 1]) {
            pos -= 1;
        }
        self.cursor = pos;
    }

    pub fn move_to_buffer_start(&mut self) {
        self.cursor = 0;
    }

    pub fn move_to_buffer_end(&mut self) {
        self.cursor = self.buffer.char_len();
    }
}
