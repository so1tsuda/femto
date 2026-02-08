# Syntax Highlight Specification (v0.1)

更新日: 2026-02-08

## 1. 目的
- Markdown編集時に軽量なシンタックスハイライトを提供する。
- 将来、他言語を同じ仕組みで追加できる構成にする。

## 2. 現在実装
- レンダリング方式: `textarea` + `pre.highlight` の2層構成
- 入力ソース: `textarea`（編集・カーソル管理は既存ロジックを継続）
- 表示ソース: `pre.highlight`（トークンごとに `span` を出力）
- 対応言語:
  - `markdown` (`.md`, `.markdown`)
  - `plain` (それ以外)
- Markdown対応トークン:
  - Heading (`#`)
  - Quote (`>`)
  - List marker (`-`, `*`, `+`, `1.`)
  - Horizontal rule (`---`, `***`, `___`)
  - Fence code block (``` )
  - Inline code (`` `code` ``)
  - Strong (`**bold**`)
  - Emphasis (`*italic*`)
  - Link (`[text](url)`)

## 3. 拡張設計
- ファイル: `src/editor/syntax.ts`
- 拡張ポイント:
  1. `detectLanguage(filePath)` に拡張子マッピングを追加
  2. `highlightText(text, filePath)` で言語ごとのハイライターに分岐
  3. 必要トークンのCSSクラスを `src/styles/main.css` に追加
- 推奨インターフェース:
```ts
type LanguageId = "markdown" | "plain" | "typescript" | "rust";
type Highlighter = (text: string) => string;
```

## 4. 非機能要件
- 1MB程度のテキストで入力遅延を体感させない。
- パースは1パスまたは行単位処理を優先。
- XSS回避のため、すべての未加工文字列はHTMLエスケープする。

## 5. 将来対応（v0.2+）
- TS/JS、Rust、Pythonを順次追加
- ハイライト差分更新（全量再描画からの改善）
- テーマ切替時のトークン配色切替
- ミニマップ/検索ハイライトとの統合
