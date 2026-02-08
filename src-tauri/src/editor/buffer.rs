#[derive(Debug, Clone)]
pub struct TextBuffer {
    text: String,
}

impl TextBuffer {
    pub fn new() -> Self {
        Self {
            text: String::new(),
        }
    }

    pub fn from_text(text: String) -> Self {
        Self { text }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }

    pub fn char_len(&self) -> usize {
        self.text.chars().count()
    }

    pub fn insert_str(&mut self, index: usize, s: &str) {
        let byte = char_to_byte_index(&self.text, index);
        self.text.insert_str(byte, s);
    }

    pub fn remove_range(&mut self, start: usize, end: usize) {
        if start >= end {
            return;
        }
        let start_byte = char_to_byte_index(&self.text, start);
        let end_byte = char_to_byte_index(&self.text, end);
        self.text.replace_range(start_byte..end_byte, "");
    }
}

pub fn char_to_byte_index(text: &str, char_index: usize) -> usize {
    text.char_indices()
        .nth(char_index)
        .map_or(text.len(), |(idx, _)| idx)
}
