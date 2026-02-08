<p align="center">
  <img src="image/Femto-icon.png" alt="Femto Logo" width="128" height="128">
</p>

<h1 align="center">Femto</h1>

<p align="center">
  <strong>Tiny in Size, Emacs at Heart.</strong>
</p>

<p align="center">
  Windows 向けの軽量 Emacs 互換テキストエディタ<br>
  Tauri v2 + TypeScript + Rust で構築
</p>

<p align="center">
  <a href="#特徴">特徴</a> •
  <a href="#インストール">インストール</a> •
  <a href="#キーバインド">キーバインド</a> •
  <a href="#設定">設定</a> •
  <a href="#開発">開発</a> •
  <a href="README.md">English</a>
</p>

---

## なぜ Femto を作ったのか

Emacs は素晴らしいエディタです。長年使っていれば、キーバインドは体に染みついています。しかし、Windows で GNU Emacs を使うのには不満がありました：

- 🐢 **起動も動作ももっさり**
- 🇯🇵 **日本語入力（IME）との相性が悪い**
- ⚙️ **「すぐ使える」状態にするまでの設定が面倒**

Femto はシンプルな願いから生まれました：**使い慣れた Emacs キーバインドで、Windows 上でメモやテキストをサクサク編集したい。**

### Femto の特長

- ⚡ **瞬時の起動** — 常に1秒以内
- ⌨️ **本物の Emacs キーバインド** — 妥協なし、エミュレーションではない
- 🇯🇵 **シームレスな日本語入力** — IME 変換がちゃんと動く
- 🪶 **軽量** — インストールサイズ 10MB 未満
- 🚀 **モダンなアーキテクチャ** — Rust + Tauri によるネイティブパフォーマンス
- 🎨 **カスタマイズ可能なテーマ** — YAML ベースのシンプルな設定

---

## 特徴

### コア編集機能
| 機能 | 説明 |
|------|------|
| Emacs ナビゲーション | `C-a/e`, `C-f/b`, `C-n/p`, `M-f/b`, `M-</>` |
| ファイル操作 | `C-x C-f`（開く）、`C-x C-s`（保存）、`C-x C-w`（別名保存）、`C-x C-c`（終了） |
| リージョン/マーク | `C-Space` でマーク、`C-w` カット、`M-w` コピー、`C-y` ペースト |
| Undo/Redo | `C-/` または `C-_` で Undo、`C-Shift-/` で Redo |
| 検索 | `C-s`（前方）、`C-r`（後方）、`M-%`（置換） |

### その他の機能
- 📝 **Markdown シンタックスハイライト** — 見出し、コードブロック、リンクなど
- 📁 **スマートミニバッファ** — Tab 補完と候補リスト表示
- 💾 **自動バックアップ** — 保存時に `ファイル名~` を作成
- 🎨 **テーマ対応 UI** — 色、フォント、背景画像を設定可能

---

## インストール

### ビルド済みリリース

[Releases](https://github.com/yourusername/femto/releases) から最新のインストーラをダウンロード：
- **MSI** — Windows インストーラパッケージ
- **NSIS** — スタンドアロンセットアップ

### ソースからビルド

**必要なもの：**
- [Node.js](https://nodejs.org/)（v18 以上）
- [Rust](https://rustup.rs/)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)（MSVC + Windows SDK）

```bash
git clone https://github.com/yourusername/femto.git
cd femto
npm install
npm run tauri build
```

生成物：
- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*-setup.exe`

---

## キーバインド

### ナビゲーション

| キー | 動作 |
|------|------|
| `C-f` / `C-b` | 1文字前進/後退 |
| `C-n` / `C-p` | 次の行/前の行へ移動 |
| `C-a` / `C-e` | 行頭/行末へ移動 |
| `M-f` / `M-b` | 1単語前進/後退 |
| `M-<` / `M->` | バッファの先頭/末尾へ移動 |

### 編集

| キー | 動作 |
|------|------|
| `C-d` | カーソル位置の文字を削除 |
| `Backspace` | カーソル前の文字を削除 |
| `C-Space` | マークを設定 |
| `C-w` | リージョンをカット |
| `M-w` | リージョンをコピー |
| `C-y` | ペースト（ヤンク） |
| `C-/`, `C-_` | 元に戻す |
| `C-Shift-/` | やり直し |

### ファイル・検索

| キー | 動作 |
|------|------|
| `C-x C-f` | ファイルを開く |
| `C-x C-s` | ファイルを保存 |
| `C-x C-w` | 名前を付けて保存 |
| `C-x C-c` | 終了 |
| `C-s` | インクリメンタル検索（前方） |
| `C-r` | インクリメンタル検索（後方） |
| `M-%` | 置換 |

> **メモ:** `C-` は Ctrl、`M-` は Alt を意味します

---

## 設定

Femto は YAML 設定ファイルを使用します：

```
%APPDATA%\EmacsWin\config.yaml
```

### 設定例

```yaml
theme:
  background_color: "#1e1e1e"
  text_color: "#d4d4d4"
  cursor_color: "#528bff"
  selection_bg: "#264f78"
  statusbar_bg: "#2d2d30"
  font_family: "'Cascadia Mono', 'Consolas', monospace"
  # background_image: "C:\\path\\to\\wallpaper.png"
```

### 利用可能なオプション

| キー | 説明 | 例 |
|------|------|------|
| `theme.background_color` | エディタ背景色 | `"#1e1e1e"`, `black` |
| `theme.text_color` | デフォルト文字色 | `"#d4d4d4"`, `white` |
| `theme.cursor_color` | カーソル色 | `blue`, `"#528bff"` |
| `theme.selection_bg` | 選択範囲の背景色 | `"#264f78"` |
| `theme.statusbar_bg` | ステータスバー背景色 | `"#2d2d30"` |
| `theme.font_family` | フォント指定 | `"'Consolas', monospace"` |
| `theme.background_image` | 背景画像パス | `"C:\\...\\image.png"` |

詳細は [`docs/config.example.yaml`](docs/config.example.yaml) を参照してください。

---

## 開発

### 開発モードで実行

```bash
npm run tauri dev
```

### プロジェクト構成

```
femto/
├── src/                    # フロントエンド（TypeScript）
│   ├── main.ts             # アプリケーションエントリポイント
│   ├── editor/
│   │   ├── commands.ts     # エディタコマンド
│   │   ├── keybindings.ts  # キーバインド定義
│   │   ├── minibuffer.ts   # ミニバッファ実装
│   │   ├── syntax.ts       # Markdown シンタックスハイライト
│   │   ├── config.ts       # 設定ローダー
│   │   ├── ui.ts           # UI レンダリング
│   │   └── types.ts        # 型定義
│   └── styles/
│       └── main.css        # スタイルシート
├── src-tauri/              # バックエンド（Rust）
│   ├── src/
│   │   └── lib.rs          # Tauri コマンド
│   └── Cargo.toml
└── docs/
    ├── CONFIG.md           # 設定ドキュメント
    └── SPEC.md             # 詳細仕様書
```

---

## ロードマップ

- [ ] 複数バッファ / 分割ウィンドウ
- [ ] プラグインシステム
- [ ] より多くの言語のシンタックスハイライト
- [ ] macOS / Linux 対応

---

## コントリビューション

コントリビューションは大歓迎です！お気軽に Pull Request を送ってください。

---

## ライセンス

[MIT License](LICENSE)

---

<p align="center">
  より軽いものを求める Emacs 愛好家のために ❤️ を込めて作りました。
</p>
