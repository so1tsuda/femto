#[derive(Debug, Clone)]
pub struct UndoSnapshot {
    pub text: String,
    pub cursor: usize,
}

#[derive(Debug, Clone)]
pub struct UndoStack {
    undo_stack: Vec<UndoSnapshot>,
    redo_stack: Vec<UndoSnapshot>,
    max_size: usize,
}

impl UndoStack {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_size: 1000,
        }
    }

    pub fn push_undo(&mut self, snapshot: UndoSnapshot) {
        self.undo_stack.push(snapshot);
        if self.undo_stack.len() > self.max_size {
            self.undo_stack.remove(0);
        }
    }

    pub fn pop_undo(&mut self) -> Option<UndoSnapshot> {
        self.undo_stack.pop()
    }

    pub fn push_redo(&mut self, snapshot: UndoSnapshot) {
        self.redo_stack.push(snapshot);
        if self.redo_stack.len() > self.max_size {
            self.redo_stack.remove(0);
        }
    }

    pub fn pop_redo(&mut self) -> Option<UndoSnapshot> {
        self.redo_stack.pop()
    }

    pub fn clear_redo(&mut self) {
        self.redo_stack.clear();
    }

    pub fn clear_all(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}
