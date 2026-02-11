use serde::Serialize;

use crate::editor::state::BufferState;

#[derive(Debug, Clone)]
pub struct QueryReplaceSession {
    pub query: String,
    pub replace_with: String,
    pub search_from: usize,
    pub replaced_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryReplaceStatus {
    pub done: bool,
    pub replaced_count: usize,
    pub next_line: Option<usize>,
    pub next_col: Option<usize>,
    pub message: String,
}

impl BufferState {
    pub fn isearch_forward(&mut self, query: &str) -> Result<(), String> {
        if query.is_empty() {
            return Err("search query is empty".to_string());
        }

        let start = (self.cursor + 1).min(self.buffer.char_len());
        if let Some(pos) = self.find_next_match_from(start, query) {
            self.cursor = pos;
            self.set_status_message(Some(format!("I-Search forward: {}", query)));
            return Ok(());
        }

        if let Some(pos) = self.find_next_match_from(0, query) {
            self.cursor = pos;
            self.set_status_message(Some(format!("I-Search wrapped: {}", query)));
            return Ok(());
        }

        Err(format!("Not found: {}", query))
    }

    pub fn isearch_backward(&mut self, query: &str) -> Result<(), String> {
        if query.is_empty() {
            return Err("search query is empty".to_string());
        }

        let start = self.cursor.saturating_sub(1);
        if let Some(pos) = self.find_prev_match_from(start, query) {
            self.cursor = pos;
            self.set_status_message(Some(format!("I-Search backward: {}", query)));
            return Ok(());
        }

        if let Some(pos) = self.find_prev_match_from(self.buffer.char_len(), query) {
            self.cursor = pos;
            self.set_status_message(Some(format!("I-Search wrapped: {}", query)));
            return Ok(());
        }

        Err(format!("Not found: {}", query))
    }

    pub fn start_query_replace(
        &mut self,
        query: String,
        replace_with: String,
    ) -> Result<QueryReplaceStatus, String> {
        if query.is_empty() {
            return Err("query must not be empty".to_string());
        }

        self.query_replace_session = Some(QueryReplaceSession {
            query,
            replace_with,
            search_from: 0,
            replaced_count: 0,
        });

        Ok(self.query_replace_next_status())
    }

    pub fn query_replace_step(&mut self, action: &str) -> Result<QueryReplaceStatus, String> {
        let action = action.to_lowercase();
        if action != "y" && action != "n" && action != "!" && action != "q" {
            return Err("action must be one of y/n/!/q".to_string());
        }

        if action == "q" {
            let replaced_count = self
                .query_replace_session
                .as_ref()
                .map_or(0, |session| session.replaced_count);
            self.query_replace_session = None;
            self.set_status_message(Some(format!(
                "Query replace cancelled ({} replaced)",
                replaced_count
            )));
            return Ok(QueryReplaceStatus {
                done: true,
                replaced_count,
                next_line: None,
                next_col: None,
                message: "Cancelled".to_string(),
            });
        }

        let (query, replace_with, search_from, replaced_count) = {
            let session = self
                .query_replace_session
                .as_ref()
                .ok_or_else(|| "query replace is not active".to_string())?;
            (
                session.query.clone(),
                session.replace_with.clone(),
                session.search_from,
                session.replaced_count,
            )
        };

        let maybe_pos = self.find_next_match_from(search_from, &query);
        let Some(pos) = maybe_pos else {
            self.query_replace_session = None;
            self.set_status_message(Some(format!(
                "Replaced {} occurrences",
                replaced_count
            )));
            return Ok(QueryReplaceStatus {
                done: true,
                replaced_count,
                next_line: None,
                next_col: None,
                message: format!("Replaced {} occurrences", replaced_count),
            });
        };

        if action == "!" {
            let mut count = replaced_count;
            let mut next_from = pos;
            let query_len = query.chars().count();
            let replace_len = replace_with.chars().count();

            while let Some(found) = self.find_next_match_from(next_from, &query) {
                self.replace_range(found, found + query_len, &replace_with);
                count += 1;
                next_from = found + replace_len;
            }

            self.query_replace_session = None;
            self.modified = true;
            self.set_status_message(Some(format!("Replaced {} occurrences", count)));
            return Ok(QueryReplaceStatus {
                done: true,
                replaced_count: count,
                next_line: None,
                next_col: None,
                message: format!("Replaced {} occurrences", count),
            });
        }

        let mut next_search_from = pos + query.chars().count();
        let mut next_replaced_count = replaced_count;

        if action == "y" {
            self.replace_range(pos, pos + query.chars().count(), &replace_with);
            self.cursor = pos + replace_with.chars().count();
            self.modified = true;
            next_search_from = self.cursor;
            next_replaced_count += 1;
        }

        if let Some(session) = self.query_replace_session.as_mut() {
            session.search_from = next_search_from;
            session.replaced_count = next_replaced_count;
        }

        Ok(self.query_replace_next_status())
    }

    pub fn query_replace_next_status(&mut self) -> QueryReplaceStatus {
        let Some(session) = self.query_replace_session.as_ref() else {
            return QueryReplaceStatus {
                done: true,
                replaced_count: 0,
                next_line: None,
                next_col: None,
                message: "No active query replace".to_string(),
            };
        };

        if let Some(pos) = self.find_next_match_from(session.search_from, &session.query) {
            self.cursor = pos;
            let (line, col) = self.line_col_at(pos);
            QueryReplaceStatus {
                done: false,
                replaced_count: session.replaced_count,
                next_line: Some(line),
                next_col: Some(col),
                message: format!(
                    "Replace at L:{} C:{}? (y/n/!/q)",
                    line,
                    col
                ),
            }
        } else {
            let replaced = session.replaced_count;
            self.query_replace_session = None;
            self.set_status_message(Some(format!("Replaced {} occurrences", replaced)));
            QueryReplaceStatus {
                done: true,
                replaced_count: replaced,
                next_line: None,
                next_col: None,
                message: format!("Replaced {} occurrences", replaced),
            }
        }
    }

    fn find_next_match_from(&self, start_char: usize, query: &str) -> Option<usize> {
        let text = self.buffer.as_str();
        let start_byte = crate::editor::buffer::char_to_byte_index(text, start_char);
        let relative = text.get(start_byte..)?.find(query)?;
        let byte_pos = start_byte + relative;
        Some(text[..byte_pos].chars().count())
    }

    fn find_prev_match_from(&self, start_char: usize, query: &str) -> Option<usize> {
        let text = self.buffer.as_str();
        let start_byte = crate::editor::buffer::char_to_byte_index(text, start_char);
        let haystack = text.get(..start_byte)?;
        let byte_pos = haystack.rfind(query)?;
        Some(text[..byte_pos].chars().count())
    }

    fn replace_range(&mut self, start: usize, end: usize, replacement: &str) {
        self.buffer.remove_range(start, end);
        self.buffer.insert_str(start, replacement);
    }
}
