<p align="center">
  <img src="image/Femto-icon.png" alt="Femto Logo" width="128" height="128">
</p>

<h1 align="center">Femto</h1>

<p align="center">
  <strong>Tiny in Size, Emacs at Heart.</strong>
</p>

<p align="center">
  A lightweight, Emacs-compatible text editor for Windows.<br>
  Built with Tauri v2 + TypeScript + Rust.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#keybindings">Keybindings</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a> •
  <a href="README.ja.md">日本語</a>
</p>

---

## Why Femto?

Emacs is a fantastic editor—if you've used it for years, those keybindings are in your muscle memory. But running GNU Emacs on Windows comes with frustrations:

- 🐢 **Sluggish startup and response**
- 🇯🇵 **Broken Japanese IME integration**
- ⚙️ **Complex setup for a "just works" experience**

Femto was born from a simple desire: **to edit notes and text with real Emacs keybindings—instantly, natively, on Windows.**

### What You Get

- ⚡ **Instant startup** — Under 1 second, always
- ⌨️ **True Emacs keybindings** — No compromises, no emulation layers
- 🇯🇵 **Seamless Japanese input** — IME composition that actually works
- 🪶 **Tiny footprint** — Less than 10 MB installed
- 🚀 **Modern architecture** — Built with Rust + Tauri for native performance
- 🎨 **Customizable themes** — YAML-based, simple configuration

---

## Features

### Core Editing
| Feature | Description |
|---------|-------------|
| Emacs navigation | `C-a/e`, `C-f/b`, `C-n/p`, `M-f/b`, `M-</>` |
| File operations | `C-x C-f` (open), `C-x C-s` (save), `C-x C-w` (save as), `C-x C-c` (quit) |
| Region/Mark | `C-Space` to set mark, `C-w` cut, `M-w` copy, `C-y` paste |
| Undo/Redo | `C-/` or `C-_` to undo, `C-Shift-/` to redo |
| Search | `C-s` (forward), `C-r` (reverse), `M-%` (query-replace) |

### Additional Features
- 📝 **Markdown syntax highlighting** — Headers, code blocks, links, and more
- 📁 **Smart minibuffer** — Tab completion with candidate list
- 💾 **Auto backup** — Creates `filename~` on save
- 🎨 **Themeable UI** — Colors, fonts, and background images

---

## Installation

### Pre-built Releases

Download the latest installer from [Releases](https://github.com/yourusername/femto/releases):
- **MSI** — Windows Installer package
- **NSIS** — Standalone setup executable

### Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) (MSVC + Windows SDK)

```bash
git clone https://github.com/yourusername/femto.git
cd femto
npm install
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*-setup.exe`

---

## Keybindings

### Navigation

| Key | Action |
|-----|--------|
| `C-f` / `C-b` | Move forward/backward one character |
| `C-n` / `C-p` | Move to next/previous line |
| `C-a` / `C-e` | Move to beginning/end of line |
| `M-f` / `M-b` | Move forward/backward one word |
| `M-<` / `M->` | Move to beginning/end of buffer |

### Editing

| Key | Action |
|-----|--------|
| `C-d` | Delete character at cursor |
| `Backspace` | Delete character before cursor |
| `C-Space` | Set mark |
| `C-w` | Cut region |
| `M-w` | Copy region |
| `C-y` | Paste (yank) |
| `C-/`, `C-_` | Undo |
| `C-Shift-/` | Redo |

### File & Search

| Key | Action |
|-----|--------|
| `C-x C-f` | Open file |
| `C-x C-s` | Save file |
| `C-x C-w` | Save file as... |
| `C-x C-c` | Quit |
| `C-s` | Incremental search (forward) |
| `C-r` | Incremental search (reverse) |
| `M-%` | Query replace |

> **Note:** `C-` means Ctrl, `M-` means Alt

---

## Configuration

Femto uses a YAML configuration file located at:

```
%APPDATA%\EmacsWin\config.yaml
```

### Example Configuration

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

### Available Options

| Key | Description | Example |
|-----|-------------|---------|
| `theme.background_color` | Editor background | `"#1e1e1e"`, `black` |
| `theme.text_color` | Default text color | `"#d4d4d4"`, `white` |
| `theme.cursor_color` | Caret color | `blue`, `"#528bff"` |
| `theme.selection_bg` | Selection highlight | `"#264f78"` |
| `theme.statusbar_bg` | Status bar background | `"#2d2d30"` |
| `theme.font_family` | Font stack | `"'Consolas', monospace"` |
| `theme.background_image` | Background image path | `"C:\\...\\image.png"` |

See [`docs/config.example.yaml`](docs/config.example.yaml) for a complete example.

---

## Development

### Run in Development Mode

```bash
npm run tauri dev
```

### Project Structure

```
femto/
├── src/                    # Frontend (TypeScript)
│   ├── main.ts             # Application entry point
│   ├── editor/
│   │   ├── commands.ts     # Editor commands
│   │   ├── keybindings.ts  # Keybinding definitions
│   │   ├── minibuffer.ts   # Minibuffer implementation
│   │   ├── syntax.ts       # Markdown syntax highlighting
│   │   ├── config.ts       # Configuration loader
│   │   ├── ui.ts           # UI rendering
│   │   └── types.ts        # Type definitions
│   └── styles/
│       └── main.css        # Stylesheets
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   └── lib.rs          # Tauri commands
│   └── Cargo.toml
└── docs/
    ├── CONFIG.md           # Configuration documentation
    └── SPEC.md             # Full specification
```

---

## Roadmap

- [ ] Multiple buffers / split windows
- [ ] Plugin system
- [ ] More language syntax highlighting
- [ ] macOS / Linux support

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

[MIT License](LICENSE)

---

<p align="center">
  Made with ❤️ for Emacs lovers who want something lighter.
</p>
