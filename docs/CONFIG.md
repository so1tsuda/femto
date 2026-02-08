# Config File

配置先:
- `%APPDATA%\EmacsWin\config.yaml`

形式:
- YAML

サンプル:
- `docs/config.example.yaml`

利用可能キー:
- `theme.background_color`
- `theme.text_color`
- `theme.cursor_color`
- `theme.selection_bg`
- `theme.statusbar_bg`
- `theme.background_image` (任意、ローカルパス/URL)
- `theme.font_family` (例: `"'Consolas', 'MS Gothic', monospace"`)

注記:
- ミニバッファ背景/文字色はエディタ本文と同一です（分離設定しません）。

色指定について:
- 英語色名が使えます（例: `black`, `gray`, `white`, `blue`, `pink`）
- Hex 形式も使えます（例: `#1e1e1e`, `#ff66cc`）
- `#` なしHex (`1e1e1e` など) も受け付けます
