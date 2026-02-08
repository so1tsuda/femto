```markdown
# Windows Emacs風テキストエディタ 完全仕様書
**Version**: 1.0.0  
**Target Platform**: Windows 10/11 (64-bit)  
**Framework**: Tauri v2  
**Purpose**: Obsidianメモ編集用の軽量Emacsキーバインディング対応エディタ

---

## 1. プロジェクト概要

### 1.1 目的
Windows環境で動作する、Emacsのキーバインディングを完全再現した軽量テキストエディタを開発する。xyzzyの現代版として、1MB以下のMarkdownファイルやテキストファイルの編集に最適化する。

### 1.2 ターゲットユーザー
- Emacsキーバインディングに慣れたユーザー
- Obsidianでメモを管理しているユーザー
- 軽量で高速なエディタを求めるユーザー

### 1.3 非機能要件
- 起動時間: 1秒以内
- ファイル読み込み（1MB）: 500ms以内
- キー入力レスポンス: 16ms以内（60fps維持）
- メモリ使用量: 100MB以下（アイドル時）
- バイナリサイズ: 15MB以下
- IME完全対応: 日本語入力が遅延なく動作

---

## 2. 技術スタック

### 2.1 フロントエンド
- **言語**: TypeScript 5.x
- **ビルドツール**: Vite 6.x
- **スタイリング**: CSS3（ミニマルデザイン）
- **エディタコンポーネント**: Plain `<textarea>` または `<div contenteditable>`（軽量化のため外部ライブラリ不使用）

### 2.2 バックエンド
- **言語**: Rust 1.80+
- **フレームワーク**: Tauri v2.1+
- **非同期ランタイム**: tokio 1.x
- **ファイルI/O**: `std::fs` + `tokio::fs`（非同期）
- **文字コード処理**: 以下参照

#### 2.2.1 エンコーディング処理
- **読み込み時**: BOM検出 + 文字パターンによる自動判定（UTF-8, Shift-JIS, EUC-JP）
- **UTF-8以外**: 警告ダイアログ表示「このファイルはUTF-8以外のエンコーディング（{detected}）です。UTF-8として保存されます。」
- **保存時**: 常にUTF-8（BOMなし）で保存
- **依存ライブラリ**: `encoding_rs` クレートを使用

#### 2.2.2 改行コード処理
- **読み込み時**: 自動検出（LF / CRLF / CR）
- **保存時**: 元ファイルの改行コードを維持
- **新規ファイル**: OSデフォルト（Windows: CRLF）
- **設定で変更可能**: 将来的に設定ファイルで固定値指定可能に

### 2.3 依存ライブラリ（Rust）
```toml
[dependencies]
tauri = { version = "2.1", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["fs", "io-util"] }
encoding_rs = "0.8"  # エンコーディング自動判定用
```

### 2.4 依存ライブラリ（TypeScript）
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.1.0",
    "@tauri-apps/plugin-dialog": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

---

## 3. アーキテクチャ設計

### 3.1 全体構成図
```
┌─────────────────────────────────────┐
│       Frontend (TypeScript)         │
│  ┌─────────────────────────────┐   │
│  │   UI Layer (HTML/CSS)       │   │
│  │  - Textarea エディタ領域     │   │
│  │  - ステータスバー            │   │
│  │  - 検索/置換ダイアログ       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  KeyBinding Handler         │   │
│  │  - キーイベントキャプチャ    │   │
│  │  - Emacsコマンドマッピング   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
              ↕ Tauri Invoke API
┌─────────────────────────────────────┐
│        Backend (Rust)               │
│  ┌─────────────────────────────┐   │
│  │   Editor Core               │   │
│  │  - TextBuffer (Gap Buffer)  │   │
│  │  - Cursor管理               │   │
│  │  - Undo/Redoスタック        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Command Handlers          │   │
│  │  - 移動コマンド             │   │
│  │  - 編集コマンド             │   │
│  │  - 検索/置換                │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   File I/O                  │   │
│  │  - 非同期読み込み           │   │
│  │  - 非同期保存               │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 3.2 データ構造設計

#### 3.2.1 TextBuffer（Rust側）
Gap Bufferアルゴリズムを採用。小規模ファイルでの高速編集に最適化。

```rust
pub struct TextBuffer {
    content: Vec<char>,      // テキスト内容（UTF-8文字列）
    gap_start: usize,        // Gapの開始位置
    gap_end: usize,          // Gapの終了位置
    cursor: usize,           // カーソル位置（論理位置）
}
```

**Gap Buffer特性**:
- カーソル位置での挿入・削除が O(1)
- カーソル移動が O(n)（小規模ファイルでは問題なし）
- メモリ効率が高い

#### 3.2.2 Undo/Redo Stack
```rust
pub struct EditAction {
    action_type: ActionType,  // Insert | Delete | Replace
    position: usize,
    old_text: String,
    new_text: String,
    timestamp: u64,
}

pub struct UndoStack {
    undo_stack: Vec<EditAction>,
    redo_stack: Vec<EditAction>,
    max_size: usize,          // デフォルト1000
}
```

#### 3.2.3 EditorState（共有状態）
```rust
pub enum LineEnding {
    Lf,    // Unix/Linux/macOS
    Crlf,  // Windows
    Cr,    // Classic Mac (rare)
}

pub struct EditorState {
    buffer: TextBuffer,
    undo_stack: UndoStack,
    file_path: Option<PathBuf>,
    modified: bool,
    line_count: usize,
    original_encoding: String,  // 検出された元エンコーディング
    line_ending: LineEnding,    // 元ファイルの改行コード
}
```

---

## 4. 機能要件詳細

### 4.1 必須Emacsキーバインディング

> **重要**: 本エディタはEmacsキーバインディングを**Windows標準より優先**します。
> - `Ctrl+S` は「Emacsの前方検索」であり、「Windowsの保存」ではありません
> - `Ctrl+C` / `Ctrl+V` は標準動作せず、Emacs流の `Ctrl+W` / `Ctrl+Y` を使用
> - ただし、システムクリップボードとの連携は維持（下記Kill Ring仕様参照）

#### 4.1.1 カーソル移動

| キーバインド | 機能 | Emacsコマンド名 | 実装メソッド |
|-------------|------|----------------|-------------|
| `Ctrl+F` | 1文字前進 | `forward-char` | `move_forward()` |
| `Ctrl+B` | 1文字後退 | `backward-char` | `move_backward()` |
| `Ctrl+N` | 次の行へ | `next-line` | `move_next_line()` |
| `Ctrl+P` | 前の行へ | `previous-line` | `move_previous_line()` |
| `Ctrl+A` | 行頭へ移動 | `move-beginning-of-line` | `move_to_line_start()` |
| `Ctrl+E` | 行末へ移動 | `move-end-of-line` | `move_to_line_end()` |
| `Alt+F` | 次の単語へ | `forward-word` | `move_forward_word()` |
| `Alt+B` | 前の単語へ | `backward-word` | `move_backward_word()` |
| `Alt+<` または `Ctrl+Home` | バッファ先頭へ | `beginning-of-buffer` | `move_to_buffer_start()` |
| `Alt+>` または `Ctrl+End` | バッファ末尾へ | `end-of-buffer` | `move_to_buffer_end()` |

**単語の定義**:
- **英数字**: `\W`（英数字・アンダースコア以外）を区切りとする
- **日本語**: ひらがな・カタカナ・漢字の文字種境界で区切る（例: 「これはテスト」→ 3単語）

#### 4.1.2 編集コマンド

| キーバインド | 機能 | Emacsコマンド名 | 実装メソッド |
|-------------|------|----------------|-------------|
| `Ctrl+D` | カーソル位置の文字を削除 | `delete-char` | `delete_char()` |
| `Backspace` | カーソル前の文字を削除 | `delete-backward-char` | `delete_backward_char()` |
| `Ctrl+K` | カーソル位置から行末まで切り取り | `kill-line` | `kill_line()` |
| `Ctrl+W` | リージョンを切り取り | `kill-region` | `kill_region()` |
| `Alt+W` | リージョンをコピー | `copy-region-as-kill` | `copy_region()` |
| `Ctrl+Y` | ヤンク（貼り付け） | `yank` | `yank()` |
| `Ctrl+/` または `Ctrl+_` | Undo | `undo` | `undo()` |
| `Ctrl+Shift+/` または `Ctrl+?` | Redo | `redo` | `redo()` |
| `Ctrl+Space` | マーク設定 | `set-mark-command` | `set_mark()` |

**Kill Ring実装**:
- 最大10個の切り取り/コピー履歴を保持
- `Ctrl+K`連続実行時は1つのKillエントリとして結合

**システムクリップボード連携**:
- `Ctrl+W` (kill-region) / `Alt+W` (copy-region): Kill Ringに追加 + **システムクリップボードにもコピー**
- `Ctrl+Y` (yank): Kill Ringの最新エントリを使用（システムクリップボードが外部のアプリから変更されている場合はそちらを優先）
- 他アプリとのコピー＆ペーストの相互運用性を確保

#### 4.1.3 検索・置換

| キーバインド | 機能 | Emacsコマンド名 | 実装メソッド |
|-------------|------|----------------|-------------|
| `Ctrl+S` | インクリメンタル検索（前方） | `isearch-forward` | `isearch_forward()` |
| `Ctrl+R` | インクリメンタル検索（後方） | `isearch-backward` | `isearch_backward()` |
| `Alt+%` (Alt+Shift+5) | 文字列置換（インタラクティブ） | `query-replace` | `query_replace()` |

**Ctrl+S (インクリメンタル検索) 仕様**:
1. `Ctrl+S`を押すとミニバッファに "I-Search: " と表示
2. ユーザーが文字を入力するたびにリアルタイムで検索
3. 次の一致箇所へカーソル移動（マッチ箇所をハイライト）
4. 再度`Ctrl+S`で次の一致へジャンプ
5. `Enter`で検索確定、`Ctrl+G`でキャンセル

**Alt+% (置換) 仕様**:
1. ミニバッファに "Replace: " と表示、検索文字列入力
2. `Enter`後、"Replace [検索文字列] with: " と表示、置換文字列入力
3. 最初の一致箇所へ移動し、以下のプロンプト表示:
   ```
   Replace? (y/n/!/q)
   ```
4. ユーザー入力処理:
   - `y`: この箇所を置換して次へ移動
   - `n`: スキップして次の一致へ移動
   - `!`: **残り全ての一致箇所を一括置換**（yesではなく!が all yes）
   - `q`: 置換を中止してエディタに戻る
5. 全ての一致を処理後、"Replaced N occurrences" と表示

#### 4.1.4 ファイル操作

| キーバインド | 機能 | Emacsコマンド名 | 実装メソッド |
|-------------|------|----------------|-------------|
| `Ctrl+X Ctrl+F` | ファイルを開く | `find-file` | `open_file()` |
| `Ctrl+X Ctrl+S` | 保存 | `save-buffer` | `save_file()` |
| `Ctrl+X Ctrl+W` | 名前を付けて保存 | `write-file` | `save_file_as()` |
| `Ctrl+X Ctrl+C` | 終了 | `save-buffers-kill-terminal` | `quit()` |

**2ストロークキーバインディング実装**:
- `Ctrl+X`を検出したら**次のキーを無制限で待機**（Emacs標準動作）
- `Ctrl+G`でキャンセル、無効なキーで状態リセット
- ステータスバーに "C-x-" と表示してフィードバック

#### 4.1.5 その他

| キーバインド | 機能 | 実装メソッド |
|-------------|------|-------------|
| `Ctrl+G` | コマンドキャンセル | `keyboard_quit()` |
| `Alt+X` | コマンド実行（ミニバッファ） | `execute_extended_command()` |
| `Ctrl+L` | 画面再描画（カーソル中央へ） | `recenter()` |
| `Alt+G Alt+G` または `Ctrl+G G` | 指定行へジャンプ | `goto_line()` |
| `Ctrl+X Ctrl+R` | 最近開いたファイル履歴 | `recent_files()` |
| (ドラッグ＆ドロップ) | ファイルをウィンドウにドロップして開く | `handle_file_drop()` |

---

### 4.2 UI設計

#### 4.2.1 レイアウト構成
```
┌─────────────────────────────────────┐
│  Menu Bar (Optional)                 │ ← 最小限のメニュー
├─────────────────────────────────────┤
│                                      │
│                                      │
│      Editor Area (Textarea)          │ ← 全画面の90%
│                                      │
│                                      │
├─────────────────────────────────────┤
│  Status Bar                          │ ← 1行、高さ24px
│  [行:列] [文字数] [エンコード] [Modified] │
├─────────────────────────────────────┤
│  Minibuffer (条件付き表示)            │ ← 検索/置換時のみ
└─────────────────────────────────────┘
```

#### 4.2.2 スタイリング仕様

**カラースキーム（ダーク）**:
```css
:root {
  --bg-color: #1e1e1e;           /* エディタ背景 */
  --text-color: #d4d4d4;         /* テキスト色 */
  --cursor-color: #00ff00;       /* カーソル色 */
  --selection-bg: #264f78;       /* 選択範囲背景 */
  --statusbar-bg: #2d2d30;       /* ステータスバー背景 */
  --minibuffer-bg: #3c3c3c;      /* ミニバッファ背景 */
  --search-highlight: #ffff00;   /* 検索ハイライト */
}
```

**フォント設定**:
```css
#editor-textarea {
  font-family: 'Consolas', 'MS Gothic', monospace;
  font-size: 14px;
  line-height: 1.6;
  tab-size: 4;
}
```

#### 4.2.3 ステータスバー表示内容
```
L:45 C:12  |  456 chars  |  UTF-8 (CRLF)  |  Modified  |  Emacs
```
- `L:行番号 C:列番号`: カーソル位置
- `chars`: 総文字数
- `UTF-8 (CRLF)`: 元ファイルのエンコーディング（探知値）と改行コード
- `Modified`: 未保存時に表示
- `Emacs`: モード表示（常にEmacsモード）

---

## 5. データフロー詳細

### 5.1 キー入力からUI更新まで

```
[ユーザーキー入力]
   ↓
[Frontend: KeyboardEvent]
   ↓ preventDefault() if Emacs binding
[Frontend: parseKeyBinding()]
   ↓ 識別: 例) "Ctrl+A"
[Frontend: invoke('editor_command', {cmd: 'move_to_line_start'})]
   ↓ Tauri IPC
[Backend: editor_command() handler]
   ↓
[Backend: EditorState.move_to_line_start()]
   ↓ TextBuffer操作
[Backend: return {cursor: 0, line: 1, col: 0}]
   ↓ Tauri IPC
[Frontend: updateEditor(result)]
   ↓
[Frontend: textarea.selectionStart = result.cursor]
   ↓
[UI更新完了]
```

### 5.2 ファイル保存フロー

```
[ユーザー: Ctrl+X Ctrl+S]
   ↓
[Frontend: invoke('save_file')]
   ↓
[Backend: save_file() handler]
   ↓
[Backend: if file_path.is_none() → show_save_dialog()]
   ↓ ユーザーがパス選択
[Backend: tokio::fs::write(path, buffer.to_string())]
   ↓
[Backend: EditorState.modified = false]
   ↓
[Backend: return {success: true, path: "C:\\..."}]
   ↓
[Frontend: updateStatusBar("Saved: C:\\...")]
```

---

## 6. 実装詳細

### 6.1 プロジェクトディレクトリ構成

```
emacs-win-editor/
├── src-tauri/                   # Rustバックエンド
│   ├── src/
│   │   ├── main.rs              # エントリーポイント、Tauriセットアップ
│   │   ├── editor/
│   │   │   ├── mod.rs           # エディタモジュールのルート
│   │   │   ├── buffer.rs        # TextBuffer（Gap Buffer実装）
│   │   │   ├── state.rs         # EditorState構造体
│   │   │   ├── cursor.rs        # カーソル移動ロジック
│   │   │   ├── edit.rs          # 編集コマンド（insert, delete, kill）
│   │   │   ├── search.rs        # 検索・置換ロジック
│   │   │   └── undo.rs          # Undo/Redoスタック
│   │   ├── commands.rs          # Tauri Commandハンドラー
│   │   └── file_io.rs           # ファイル読み書き
│   ├── Cargo.toml
│   └── tauri.conf.json          # Tauri設定
├── src/                         # TypeScriptフロントエンド
│   ├── index.html               # メインHTML
│   ├── main.ts                  # エントリーポイント
│   ├── editor/
│   │   ├── keybindings.ts       # キーバインディング定義・解析
│   │   ├── commands.ts          # Rustコマンド呼び出しラッパー
│   │   ├── ui.ts                # UI更新ロジック
│   │   └── minibuffer.ts        # ミニバッファ制御
│   └── styles/
│       ├── main.css             # 基本スタイル
│       └── editor.css           # エディタエリアスタイル
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 6.2 重要な実装ポイント

#### 6.2.1 Gap Buffer実装（Rust）

```rust
// src-tauri/src/editor/buffer.rs
pub struct TextBuffer {
    content: Vec<char>,
    gap_start: usize,
    gap_end: usize,
}

const INITIAL_GAP_SIZE: usize = 8192;  // 8KB

impl TextBuffer {
    pub fn new() -> Self {
        Self {
            content: vec![' '; INITIAL_GAP_SIZE],  // 初期Gap 8KB
            gap_start: 0,
            gap_end: INITIAL_GAP_SIZE,
        }
    }
    
    pub fn insert_char(&mut self, ch: char) {
        if self.gap_start == self.gap_end {
            self.expand_gap();
        }
        self.content[self.gap_start] = ch;
        self.gap_start += 1;
    }
    
    pub fn delete_char(&mut self) {
        if self.gap_end < self.content.len() {
            self.gap_end += 1;
        }
    }
    
    pub fn move_gap(&mut self, position: usize) {
        if position < self.gap_start {
            // Gapを左に移動
            let count = self.gap_start - position;
            self.content.copy_within(position..self.gap_start, self.gap_end - count);
            self.gap_start = position;
            self.gap_end -= count;
        } else if position > self.gap_start {
            // Gapを右に移動
            let count = position - self.gap_start;
            self.content.copy_within(self.gap_end..self.gap_end + count, self.gap_start);
            self.gap_start += count;
            self.gap_end += count;
        }
    }
    
    pub fn to_string(&self) -> String {
        let mut result = String::new();
        result.extend(&self.content[0..self.gap_start]);
        result.extend(&self.content[self.gap_end..]);
        result
    }
    
    fn expand_gap(&mut self) {
        let new_gap_size = (self.gap_end - self.gap_start) * 2 + 1024;
        let old_len = self.content.len();
        self.content.resize(old_len + new_gap_size, ' ');
        self.content.copy_within(self.gap_end..old_len, self.gap_end + new_gap_size);
        self.gap_end += new_gap_size;
    }
}
```

#### 6.2.2 キーバインディング処理（TypeScript）

```typescript
// src/editor/keybindings.ts
interface KeyBinding {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  command: string;
}

const EMACS_KEYBINDINGS: KeyBinding[] = [
  { key: 'a', ctrl: true, alt: false, shift: false, command: 'move_to_line_start' },
  { key: 'e', ctrl: true, alt: false, shift: false, command: 'move_to_line_end' },
  { key: 'f', ctrl: true, alt: false, shift: false, command: 'move_forward' },
  { key: 'b', ctrl: true, alt: false, shift: false, command: 'move_backward' },
  { key: 'p', ctrl: true, alt: false, shift: false, command: 'move_previous_line' },
  { key: 'n', ctrl: true, alt: false, shift: false, command: 'move_next_line' },
  { key: 'd', ctrl: true, alt: false, shift: false, command: 'delete_char' },
  { key: 'k', ctrl: true, alt: false, shift: false, command: 'kill_line' },
  { key: '_', ctrl: true, alt: false, shift: false, command: 'undo' },
  { key: 's', ctrl: true, alt: false, shift: false, command: 'isearch_forward' },
  { key: '%', ctrl: false, alt: true, shift: true, command: 'query_replace' },
  // ... 他のバインディング
];

export function handleKeyDown(event: KeyboardEvent): boolean {
  const binding = EMACS_KEYBINDINGS.find(b => 
    b.key === event.key.toLowerCase() &&
    b.ctrl === event.ctrlKey &&
    b.alt === event.altKey &&
    b.shift === event.shiftKey
  );
  
  if (binding) {
    event.preventDefault();
    executeCommand(binding.command);
    return true;
  }
  return false;
}
```

#### 6.2.3 置換処理（Rust）

```rust
// src-tauri/src/editor/search.rs
#[derive(Serialize)]
pub struct ReplaceMatch {
    position: usize,
    line: usize,
    col: usize,
}

pub struct SearchState {
    query: String,
    replace_with: String,
    matches: Vec<ReplaceMatch>,
    current_index: usize,
}

impl EditorState {
    pub fn query_replace(&mut self, query: &str, replace: &str) -> Vec<ReplaceMatch> {
        let text = self.buffer.to_string();
        let matches: Vec<ReplaceMatch> = text
            .match_indices(query)
            .map(|(pos, _)| {
                let (line, col) = self.position_to_line_col(pos);
                ReplaceMatch { position: pos, line, col }
            })
            .collect();
        
        self.search_state = Some(SearchState {
            query: query.to_string(),
            replace_with: replace.to_string(),
            matches: matches.clone(),
            current_index: 0,
        });
        
        matches
    }
    
    pub fn replace_current(&mut self) -> Result<usize, String> {
        // 現在の一致箇所を置換
        // 次の一致位置を返す
    }
    
    pub fn replace_all_remaining(&mut self) -> usize {
        // 残り全てを一括置換
        // 置換数を返す
    }
}
```

### 6.3 Tauri Commandハンドラー

```rust
// src-tauri/src/commands.rs
use tauri::State;
use std::sync::Mutex;

#[tauri::command]
fn editor_command(
    command: String,
    state: State<Mutex<EditorState>>
) -> Result<CommandResult, String> {
    let mut editor = state.lock().unwrap();
    
    match command.as_str() {
        "move_to_line_start" => editor.move_to_line_start(),
        "move_to_line_end" => editor.move_to_line_end(),
        "move_forward" => editor.move_forward(),
        "move_backward" => editor.move_backward(),
        "delete_char" => editor.delete_char(),
        "kill_line" => editor.kill_line(),
        "undo" => editor.undo(),
        _ => Err(format!("Unknown command: {}", command)),
    }
}

#[tauri::command]
async fn open_file(path: String, state: State<'_, Mutex<EditorState>>) -> Result<String, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut editor = state.lock().unwrap();
    editor.load_content(&content);
    editor.file_path = Some(PathBuf::from(path));
    editor.modified = false;
    
    Ok(content)
}

#[tauri::command]
async fn save_file(state: State<'_, Mutex<EditorState>>) -> Result<String, String> {
    let editor = state.lock().unwrap();
    let path = editor.file_path.as_ref()
        .ok_or("No file path set")?;
    let content = editor.buffer.to_string();
    
    tokio::fs::write(path, content)
        .await
        .map_err(|e| e.to_string())?;
    
    drop(editor);
    state.lock().unwrap().modified = false;
    
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn start_replace(
    query: String,
    replace_with: String,
    state: State<Mutex<EditorState>>
) -> Result<Vec<ReplaceMatch>, String> {
    let mut editor = state.lock().unwrap();
    Ok(editor.query_replace(&query, &replace_with))
}

#[tauri::command]
fn replace_step(
    action: String,  // "yes" | "no" | "all" | "quit"
    state: State<Mutex<EditorState>>
) -> Result<ReplaceResult, String> {
    let mut editor = state.lock().unwrap();
    match action.as_str() {
        "yes" => editor.replace_current(),
        "all" => {
            let count = editor.replace_all_remaining();
            Ok(ReplaceResult::AllDone(count))
        },
        "no" => editor.skip_to_next(),
        "quit" => Ok(ReplaceResult::Cancelled),
        _ => Err("Invalid action".to_string()),
    }
}
```

---

## 7. 開発フェーズとマイルストーン

### Phase 1: 基礎実装（Week 1-2）
- [x] Tauriプロジェクト初期化
- [x] Gap Buffer実装とテスト
- [x] 基本的なカーソル移動（Ctrl+A/E/F/B/N/P）
- [x] TextareaベースのUI構築
- [x] ステータスバー表示

**検収基準**: カーソル移動が遅延なく動作、ステータスバーが正確に更新される

### Phase 2: 編集機能（Week 3）
- [x] 編集コマンド（Ctrl+D/K）
- [x] Undo/Redo実装
- [x] Kill Ring実装
- [x] Yank（貼り付け）機能

**検収基準**: 編集後にUndoで正確に復元、Kill Ringが正常動作

### Phase 3: 検索・置換（Week 4）
- [x] インクリメンタル検索（Ctrl+S）
- [x] ミニバッファUI実装
- [x] インタラクティブ置換（Alt+%）
- [x] 置換モード（y/n/!/q）動作確認

**検収基準**: 置換で`!`が全置換、`y`が1つずつ置換される

### Phase 4: ファイル操作（Week 5）
- [x] ファイルダイアログ統合
- [x] ファイル保存・読み込み
- [x] 2ストロークキーバインディング（Ctrl+X）
- [x] 未保存時の警告ダイアログ

**検収基準**: 1MBファイルが500ms以内に開く、保存が正常動作

### Phase 5: 最適化・仕上げ（Week 6）
- [x] パフォーマンスチューニング
- [x] メモリリーク検査
- [x] IME動作確認（日本語入力）
- [x] エラーハンドリング強化
- [x] インストーラー作成

**検収基準**: 起動1秒以内、日本語入力が遅延なく動作

---

## 8. テスト要件

### 8.1 単体テスト（Rust）

```rust
// src-tauri/src/editor/buffer.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_insert_char() {
        let mut buffer = TextBuffer::new();
        buffer.insert_char('a');
        assert_eq!(buffer.to_string(), "a");
    }
    
    #[test]
    fn test_delete_char() {
        let mut buffer = TextBuffer::new();
        buffer.insert_char('a');
        buffer.insert_char('b');
        buffer.move_gap(1);
        buffer.delete_char();
        assert_eq!(buffer.to_string(), "a");
    }
    
    #[test]
    fn test_kill_line() {
        // テストケース実装
    }
}
```

### 8.2 統合テスト（TypeScript）

```typescript
// src/tests/keybindings.test.ts
describe('Emacs Keybindings', () => {
  test('Ctrl+A moves to line start', async () => {
    // テストケース実装
  });
  
  test('Alt+% starts replace mode', async () => {
    // テストケース実装
  });
});
```

### 8.3 E2Eテスト（Tauri WebDriver）

- ファイル開く → 編集 → 保存の一連流れ
- 置換モード全体フロー（y/n/!/q）
- IME入力後の保存・読み込み

---

## 9. ビルドとデプロイ

### 9.1 開発環境セットアップ

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (via nvm)
nvm install 20
nvm use 20

# Tauri CLI
cargo install tauri-cli --version ^2.0

# プロジェクト依存関係
npm install
```

### 9.2 ビルドコマンド

```bash
# 開発モード（ホットリロード）
npm run tauri dev

# リリースビルド
npm run tauri build

# テスト実行
cargo test
npm test
```

### 9.3 リリース形式

- **Windows Installer**: `.msi` (Windows Installer XML)
- **Portable版**: `.exe`（単体実行可能）
- **配布サイズ**: 目標15MB以下

### 9.4 tauri.conf.json 設定（Tauri v2形式）

> **注意**: Tauri v2では`allowlist`は廃止され、`capabilities`システムに移行しました。

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "EmacsWin",
  "version": "0.1.0",
  "identifier": "com.emacswin.editor",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "EmacsWin Editor",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "decorations": true,
        "dragDropEnabled": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/icon.ico"
    ]
  }
}
```

### 9.5 capabilities設定（src-tauri/capabilities/default.json）

```json
{
  "$schema": "https://schema.tauri.app/capabilities/2",
  "identifier": "default",
  "description": "Default capabilities for EmacsWin",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    {
      "identifier": "fs:allow-read",
      "allow": [{ "path": "$HOME/**" }]
    },
    {
      "identifier": "fs:allow-write",
      "allow": [{ "path": "$HOME/**" }]
    }
  ]
}
```

---

## 10. パフォーマンス最適化ガイドライン

### 10.1 フロントエンド最適化
- **Virtual Scrolling**: 実装不要（1MBファイルは約2万行程度で問題なし）
- **Debounce**: ステータスバー更新を16ms毎に制限
- **RAF（RequestAnimationFrame）**: UI更新はRAFで同期

### 10.2 バックエンド最適化
- **Gap Bufferサイズ**: 初期**8KB**、拡張時は2倍成長
- **Undo Stack上限**: 1000アクションまで（メモリ節約）
- **非同期I/O**: ファイル読み書きは必ず`tokio::fs`使用

### 10.3 メモリ管理
- **Kill Ring上限**: 10エントリまで
- **定期GC**: 不使用時にBuffer圧縮（Gap削除）

### 10.4 大きなファイルの保護
| ファイルサイズ | 動作 |
|----------------|------|
| 1MB以上 | ステータスバーに「大きなファイル」注意表示 |
| 10MB以上 | 確認ダイアログ「このファイルは大きいため編集が遅くなる可能性があります。続行しますか？」 |
| 50MB以上 | 読み込み拒否「このエディタの対象外です。別のツールをお使いください。」 |

---

## 11. 既知の制約事項

1. **マルチバッファ非対応**: 単一ファイル編集のみ
2. **シンタックスハイライト非対応**: プレーンテキストのみ
3. **マクロ記録非対応**: Emacsの`C-x (`等は未実装
4. **Split Window非対応**: 画面分割機能なし
5. **LSP非対応**: コード補完なし
6. **Lisp拡張非対応**: 設定ファイルは将来的にTOML

---

## 11.1 IME対応詳細仕様

> **互換性優先度**:
> 1. **Google日本語入力** (最優先) - 主要な動作確認対象
> 2. **Windows標準IME (Microsoft IME)** - 副次的サポート

### IME変換中のキーバインディング
- **IME変換中**: `Ctrl+A/E/F/B`等のキーはIMEに渡さず、**Emacs動作を優先**
- **Ctrl+G**: IME変換中の場合は変換をキャンセル（未変換文字列を破棄）
- **Enter**: IME変換確定後に通常動作

### IME候補ウィンドウ
- Textareaベースの場合、候補ウィンドウの位置はOS/ブラウザに依存
- カスタム位置制御は将来的に検討（`ContentEditable`移行で対応可能）

### テスト要件
- Google日本語入力での全キーバインディング動作確認を必須とする
- Windows標準IMEでの基本動作確認（入力・変換・確定）

---

## 11.2 エラーハンドリング仕様

| エラーケース | 対応 |
|---------------|------|
| ファイル読み込み失敗（権限なし等） | エラーダイアログ表示、空バッファを維持 |
| ファイル保存失敗（ディスク容量不足等） | エラーダイアログ + ステータスバーに「Save failed」表示 |
| 保存後に外部でファイル変更 | 次回保存時に警告「ファイルが外部で変更されています。上書きしますか？」 |
| 読み取り専用ファイルを開く | ステータスバーに「Read-only」表示、編集試行時に警告 |
| ファイルが存在しない | 新規ファイルとして作成確認ダイアログ |

---

## 11.3 設定ファイル

**保存場所**: `%APPDATA%\EmacsWin\config.toml`

**v1.0での対応項目**:
- フォントサイズ
- フォントファミリー
- カラースキーム（将来）

```toml
# %APPDATA%\EmacsWin\config.toml
[editor]
font_family = "Consolas"
font_size = 14

[file]
default_line_ending = "auto"  # auto | lf | crlf
```

---

## 11.4 複数インスタンス動作

- **同じファイルを複数ウィンドウで開く**: 許可（警告なし）
- **競合検知**: 保存時にファイルの更新日時をチェック
- **外部変更時**: 「ファイルが外部で変更されました。再読み込みしますか？」の確認ダイアログ

---

## 11.5 自動保存・バックアップ

### 自動保存
- **間隔**: 60秒ごと（変更がある場合のみ）
- **保存先**: `%TEMP%\EmacsWin\autosave\`
- **ファイル名**: `#<元ファイル名>#`（Emacs流）
- **正常保存後**: 自動保存ファイルを削除

### バックアップ
- **保存時**: 元ファイルのバックアップを作成（`<ファイル名>~`）
- **世代数**: 1世代のみ保持（将来設定で変更可能）

### クラッシュ復旧
- 起動時に自動保存ファイルの存在をチェック
- 存在する場合: 「前回のセッションが正常終了していません。復元しますか？」

---

## 12. 将来の拡張可能性

### 12.1 v2.0での追加機能候補
- Markdown Live Preview
- シンタックスハイライト（軽量実装）
- マルチバッファ対応
- カスタムキーバインディング（設定ファイル）
- テーマ切り替え（Light/Dark）

### 12.2 プラグインシステム
- JavaScript/TypeScriptベースのプラグインAPI
- Emacs Lispからの移植ツール

---

## 13. AIコーディングエージェント向け実装指示

### 13.1 実装の優先順位
1. **最優先**: Gap Buffer + 基本カーソル移動
2. **高優先**: キーバインディングハンドラー + UI
3. **中優先**: 編集コマンド + Undo
4. **低優先**: 検索・置換

### 13.2 コーディング規約
- **Rust**: `rustfmt`準拠、`clippy`警告ゼロ
- **TypeScript**: `prettier` + `eslint`設定
- **コメント**: 英語で記述、複雑なロジックのみ
- **命名**: Emacsコマンド名をそのまま使用（snake_case）

### 13.3 デバッグ支援
- **ロギング**: `env_logger`（Rust）、`console.log`（TS）
- **開発者ツール**: Tauri DevToolsを有効化
- **パフォーマンス計測**: `console.time()`で各コマンド計測

### 13.4 質問対応
実装中に不明点があれば以下を確認:
1. Emacsマニュアル: https://www.gnu.org/software/emacs/manual/
2. Gap Bufferアルゴリズム: 既存実装参照
3. Tauri公式ドキュメント: https://v2.tauri.app/

---

## 付録A: 完全キーバインディングリファレンス

| Category | Key | Command | Description |
|----------|-----|---------|-------------|
| **移動** | C-f | forward-char | 1文字前進 |
| | C-b | backward-char | 1文字後退 |
| | C-n | next-line | 次の行 |
| | C-p | previous-line | 前の行 |
| | C-a | move-beginning-of-line | 行頭 |
| | C-e | move-end-of-line | 行末 |
| | M-f | forward-word | 次の単語 |
| | M-b | backward-word | 前の単語 |
| | M-< | beginning-of-buffer | バッファ先頭 |
| | M-> | end-of-buffer | バッファ末尾 |
| **編集** | C-d | delete-char | 文字削除 |
| | Backspace | delete-backward-char | 後方削除 |
| | C-k | kill-line | 行末まで切り取り |
| | C-w | kill-region | リージョン切り取り |
| | M-w | copy-region-as-kill | リージョンコピー |
| | C-y | yank | 貼り付け |
| | C-/ / C-_ | undo | 取り消し |
| | C-Space | set-mark-command | マーク設定 |
| **検索** | C-s | isearch-forward | 前方検索 |
| | C-r | isearch-backward | 後方検索 |
| | M-% | query-replace | 置換 |
| **ファイル** | C-x C-f | find-file | 開く |
| | C-x C-s | save-buffer | 保存 |
| | C-x C-w | write-file | 名前付保存 |
| | C-x C-c | save-buffers-kill | 終了 |
| **その他** | C-g | keyboard-quit | キャンセル |
| | C-l | recenter | 再描画 |
| | M-x | execute-command | コマンド実行 |

---

## 付録B: 開発チェックリスト

```markdown
### Phase 1: 基礎
- [ ] Tauriプロジェクト作成
- [ ] Gap Buffer実装
- [ ] 基本カーソル移動（C-a/e/f/b/n/p）
- [ ] Textarea UI + ステータスバー
- [ ] 日本語入力テスト

### Phase 2: 編集
- [ ] C-d, Backspace
- [ ] C-k (kill-line)
- [ ] Undo/Redo
- [ ] Kill Ring
- [ ] C-y (yank)

### Phase 3: 検索・置換
- [ ] C-s インクリメンタル検索
- [ ] ミニバッファUI
- [ ] M-% 置換開始
- [ ] y/n/!/q 処理

### Phase 4: ファイル
- [ ] C-x C-f ファイル開く
- [ ] C-x C-s 保存
- [ ] C-x C-w 名前付保存
- [ ] 未保存警告

### Phase 5: 仕上げ
- [ ] パフォーマンステスト
- [ ] メモリリーク検査
- [ ] エラーハンドリング
- [ ] インストーラー作成
```

---

**以上で仕様書完成です。この仕様書をAIコーディングエージェントに渡して段階的に実装を進めてください。**
```

この仕様書は以下の特徴があります：

1. **完全性**: すべての機能の動作仕様を明記
2. **実装可能性**: コード例付きで実装方法を具体化
3. **段階的開発**: Phase分けで優先順位を明確化
4. **検証可能性**: 各Phaseに検収基準を設定
5. **AI対応**: コーディング規約とデバッグ方法を明示

特に重要なポイント：
- **replace-stringの`!`がall yes**という仕様を明記
- **IME対応がTauriで自動**であることを強調
- **Gap Bufferの実装例**を具体的に提示
- **キーバインディング処理**の完全なコード例
