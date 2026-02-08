# SPEC Review (2026-02-08)

## Critical
- `docs/SPEC.md:46` の「encoding_rs で Shift-JIS/EUC-JP 自動判定」は仕様不整合。`encoding_rs` はデコードライブラリであり判定器ではないため、判定ロジックか別ライブラリ（例: chardetng）の明記が必要。
- `docs/SPEC.md:622` の `open_file` 実装例は `read_to_string` を使っており、`docs/SPEC.md:46` の「UTF-8/Shift-JIS/EUC-JP 自動判定」と両立しない（UTF-8以外を読めない）。
- `docs/SPEC.md:636` の `save_file` 実装例は `MutexGuard` を保持したまま `await` しており、実装時にコンパイルまたはデッドロック問題になり得る。
- `docs/SPEC.md:936` の「IME変換中も Ctrl+A/E/F/B は Emacs優先」は、IME候補操作との衝突リスクが高い。入力不能ケースを避けるため、composition中の優先順位ルールを再定義すべき。

## High
- `docs/SPEC.md:685` 以降の Phase が全て `[x]` 完了扱いだが、現リポジトリは仕様書のみで実装未着手だったため、進捗表記と実態が不一致。
- `docs/SPEC.md:271` の「2ストロークを無制限待機」はフォーカス喪失時のタイムアウト/キャンセル条件が未定義。
- `docs/SPEC.md:282` の `Ctrl+G G` は `Ctrl+G` のキャンセル仕様 (`docs/SPEC.md:279`) と競合。
- `docs/SPEC.md:205` の単語境界定義（日本語/英数字）は Unicode 正規化・結合文字・絵文字を含む場合の扱いが未定義。
- `docs/SPEC.md:21` と `docs/SPEC.md:25` の性能目標（起動1秒/15MB以下）は Tauri v2 + WebView2 前提では環境依存が強く、測定条件（CPU/ストレージ/初回起動含むか）が必要。

## Medium
- `docs/SPEC.md:380` の保存ダイアログ責務が Backend になっているが、2.4 では Frontend の dialog plugin 利用前提になっており責務が曖昧。
- `docs/SPEC.md:333` の列番号定義が、タブ幅・全角文字・サロゲートペア時に「表示列」か「文字インデックス」か未定義。
- `docs/SPEC.md:991` の autosave ファイル名 `#<元ファイル名>#` は同名ファイル（別ディレクトリ）衝突の仕様が未定義。
- `docs/SPEC.md:983` の複数インスタンス運用で、mtime 粒度・タイムゾーン差・ネットワークドライブ時の競合判定条件が未定義。

## Low
- `docs/SPEC.md:1` がコードフェンス開始になっており、`docs/SPEC.md:1125` で閉じた後に説明文が続く。仕様本文と補足文を分離したほうが読みやすい。
- `docs/SPEC.md:58` と `docs/SPEC.md:867` の依存/権限は最小権限設計方針（実際に必要な plugin と capability）をもう一段明確化したほうがよい。

## Verdict
- 実装は可能。
- ただし上記 Critical/High は、Phase 2以降の手戻り防止のため先に確定したほうがよい。